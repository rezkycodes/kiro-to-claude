/**
 * Request Builder for Kiro/AWS CodeWhisperer
 *
 * Builds request payloads and headers for the AWS CodeWhisperer API.
 * Converts Anthropic format to AWS CodeWhisperer format.
 */

import crypto from 'crypto';
import {
    KIRO_MODEL_MAPPING,
    KIRO_HEADERS,
    isThinkingModel
} from '../constants.js';

/**
 * Map an Anthropic model name to Kiro's internal model ID
 * @param {string} anthropicModel - The Anthropic-format model name
 * @returns {string} The Kiro/CodeWhisperer model ID
 */
export function mapModelToKiro(anthropicModel) {
    const lower = (anthropicModel || '').toLowerCase();
    
    // Check direct mappings first
    if (KIRO_MODEL_MAPPING[lower]) {
        return KIRO_MODEL_MAPPING[lower];
    }
    
    // Fuzzy matching for common patterns
    if (lower.includes('opus') && lower.includes('4.8')) {
        return 'claude-opus-4.8';
    }
    if (lower.includes('opus') && lower.includes('4.7')) {
        return 'claude-opus-4.7';
    }
    if (lower.includes('opus') && lower.includes('4.6')) {
        return 'claude-opus-4.6';
    }
    if (lower.includes('opus') && lower.includes('4.5')) {
        return 'claude-opus-4.5';
    }
    if (lower.includes('opus')) {
        return 'claude-opus-4.8';
    }
    if (lower.includes('sonnet') && lower.includes('4.6')) {
        return 'claude-sonnet-4.6';
    }
    if (lower.includes('sonnet') && lower.includes('4.5')) {
        return 'claude-sonnet-4.5';
    }
    if (lower.includes('sonnet') && (lower.includes('4.0') || lower.includes('-4'))) {
        return 'claude-sonnet-4';
    }
    if (lower.includes('sonnet') && lower.includes('5')) {
        return 'claude-sonnet-5';
    }
    if (lower.includes('sonnet')) {
        return 'claude-sonnet-4.5';
    }
    if (lower.includes('haiku')) {
        return 'claude-haiku-4.5';
    }
    if (lower.includes('deepseek')) {
        return 'deepseek-3.2';
    }
    if (lower.includes('glm')) {
        return 'glm-5';
    }
    if (lower.includes('qwen')) {
        return 'qwen3-coder-next';
    }
    if (lower.includes('minimax') && lower.includes('2.1')) {
        return 'minimax-m2.1';
    }
    if (lower.includes('minimax')) {
        return 'minimax-m2.5';
    }
    
    // Default to the most capable Opus model for unknown names
    return 'claude-opus-4.8';
}

/**
 * Convert Anthropic message format to Kiro/CodeWhisperer format
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @returns {Object} The CodeWhisperer-format request
 */
export function convertAnthropicToKiro(anthropicRequest) {
    const messages = anthropicRequest.messages || [];

    // Normalize the system prompt to a plain string.
    // Anthropic allows either a string or an array of content blocks.
    const systemPrompt = normalizeSystemPrompt(anthropicRequest.system);

    // Build a flat conversation list of { role, content } from the messages,
    // flattening content blocks into text. System is kept separate so it can be
    // handled explicitly by the request builder instead of being mislabeled as
    // a user turn in the CodeWhisperer history.
    const conversationHistory = [];
    for (const msg of messages) {
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        const content = flattenContent(msg.content);
        conversationHistory.push({ role, content });
    }

    return {
        systemPrompt,
        conversationHistory,
        maxTokens: anthropicRequest.max_tokens || 8192,
        temperature: anthropicRequest.temperature,
        topP: anthropicRequest.top_p
    };
}

/**
 * Normalize an Anthropic `system` field (string or content-block array) to text.
 * @param {string|Array|undefined} system
 * @returns {string}
 */
function normalizeSystemPrompt(system) {
    if (!system) return '';
    if (typeof system === 'string') return system;
    if (Array.isArray(system)) {
        return system
            .map(block => (typeof block === 'string' ? block : block?.text || ''))
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

/**
 * Flatten an Anthropic message `content` (string or content-block array) into a
 * single text string that CodeWhisperer can consume.
 * @param {string|Array} content
 * @returns {string}
 */
function flattenContent(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }

    const textParts = [];
    for (const block of content) {
        if (!block || typeof block !== 'object') continue;
        switch (block.type) {
            case 'text':
                textParts.push(block.text || '');
                break;
            case 'thinking':
                textParts.push(`<thinking>${block.thinking || ''}</thinking>`);
                break;
            case 'tool_use':
                textParts.push(
                    `<tool_use name="${block.name}">${JSON.stringify(block.input || {})}</tool_use>`
                );
                break;
            case 'tool_result':
                textParts.push(
                    `<tool_result tool_use_id="${block.tool_use_id}">${
                        typeof block.content === 'string'
                            ? block.content
                            : JSON.stringify(block.content)
                    }</tool_result>`
                );
                break;
            case 'image':
                // CodeWhisperer's text chat endpoint has no image support here.
                textParts.push('[Image attached]');
                break;
            default:
                break;
        }
    }
    return textParts.join('\n');
}

/**
 * Build the CodeWhisperer chat request payload
 * @param {Object} anthropicRequest - The Anthropic-format request
 * @returns {Object} The CodeWhisperer API request payload
 */
export function buildKiroRequest(anthropicRequest, options = {}) {
    const model = mapModelToKiro(anthropicRequest.model);
    const converted = convertAnthropicToKiro(anthropicRequest);
    const conversation = converted.conversationHistory;
    const profileArn = options.profileArn || null;

    // The current turn is the last message in the conversation. Normally this is
    // a user message; if it happens to be an assistant message we still send it
    // as the current user input so the request stays well-formed.
    const currentTurn = conversation[conversation.length - 1];
    let currentContent = currentTurn?.content || '';

    // Prepend the system prompt to the current user message so the model always
    // receives the system instructions. CodeWhisperer's generateAssistantResponse
    // has no dedicated system field, so this is the reliable way to pass it.
    if (converted.systemPrompt) {
        currentContent = `${converted.systemPrompt}\n\n${currentContent}`;
    }

    // Build the prior history (everything except the current turn) as a valid
    // alternating sequence of user/assistant turns. CodeWhisperer expects the
    // history to be well-paired, so we merge consecutive same-role messages and
    // drop any leading assistant message that would break the ordering.
    const priorMessages = conversation.slice(0, -1);
    const history = buildKiroHistory(priorMessages);

    return {
        conversationState: {
            conversationId: crypto.randomUUID(),
            chatTriggerType: 'MANUAL',
            customizationArn: null,
            currentMessage: {
                userInputMessage: {
                    content: currentContent,
                    modelId: model,
                    origin: 'AI_EDITOR',
                    userInputMessageContext: {
                        editorState: {
                            cursorState: null
                        }
                    }
                }
            },
            history
        },
        profileArn: profileArn,
        source: 'AI_EDITOR',
        modelId: model,
        origin: 'AI_EDITOR'
    };
}

/**
 * Build a well-formed CodeWhisperer history array from a flat list of
 * { role, content } turns. Consecutive same-role turns are merged, and the
 * history is normalized to start with a user turn so user/assistant pairs stay
 * aligned.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Array<Object>} CodeWhisperer-format history entries
 */
function buildKiroHistory(messages) {
    // Merge consecutive turns of the same role into one.
    const merged = [];
    for (const msg of messages) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
            last.content = `${last.content}\n${msg.content}`.trim();
        } else {
            merged.push({ role: msg.role, content: msg.content });
        }
    }

    // History should begin with a user turn; drop a leading assistant turn.
    if (merged.length && merged[0].role === 'assistant') {
        merged.shift();
    }

    return merged.map(msg => ({
        [msg.role === 'assistant' ? 'assistantResponseMessage' : 'userInputMessage']: {
            content: msg.content
        }
    }));
}

/**
 * Build headers for CodeWhisperer API requests
 * @param {string} token - AWS access token
 * @param {string} region - AWS region
 * @param {boolean} streaming - Whether this is a streaming request
 * @returns {Object} Headers object
 */
export function buildKiroHeaders(token, region = 'us-east-1', streaming = false) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': streaming ? 'application/vnd.amazon.eventstream' : 'application/json',
        'X-Amz-Region': region,
        ...KIRO_HEADERS
    };
    
    return headers;
}

/**
 * Build a simple chat completion request for testing
 * @param {string} prompt - The user prompt
 * @param {string} model - Model ID
 * @returns {Object} Simple request payload
 */
export function buildSimpleKiroRequest(prompt, model = 'auto') {
    return {
        conversationState: {
            conversationId: crypto.randomUUID(),
            chatTriggerType: 'MANUAL',
            currentMessage: {
                userInputMessage: {
                    content: prompt,
                    modelId: model,
                    origin: 'AI_EDITOR'
                }
            }
        },
        source: 'AI_EDITOR',
        modelId: model,
        origin: 'AI_EDITOR'
    };
}

export default {
    mapModelToKiro,
    convertAnthropicToKiro,
    buildKiroRequest,
    buildKiroHeaders,
    buildSimpleKiroRequest
};
