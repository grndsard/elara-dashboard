// Amazon Q Business embedded integration
let qBusinessLoaded = false;
let qBusinessConfig = null;
let chatHistory = [];

function initializeChat() {
    console.log('Initializing Amazon Q Business...');
    loadQBusinessEmbed();
}

async function loadQBusinessEmbed() {
    try {
        // Get Q Business configuration from backend
        const response = await apiRequest('/qbusiness/config');
        
        if (response.success && response.data.configured) {
            qBusinessConfig = response.data;
            
            if (response.data.useApi) {
                // Use API mode instead of embed
                showApiInterface();
            } else {
                // Use embed mode
                embedQBusiness();
            }
        } else {
            const message = response.data?.message || 'Amazon Q Business is not configured. Please contact your administrator.';
            showQBusinessFallback(message);
        }
    } catch (error) {
        console.error('Failed to load Q Business config:', error);
        showQBusinessFallback('Failed to connect to Amazon Q Business. Please configure the service properly.');
    }
}

function embedQBusiness() {
    const embedContainer = document.getElementById('qbusiness-embed');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    // Validate embed URL
    if (!qBusinessConfig.embedUrl || qBusinessConfig.embedUrl === 'https:localhost:3000' || !qBusinessConfig.embedUrl.startsWith('https://')) {
        showQBusinessFallback('Invalid Amazon Q Business embed URL. Please configure a valid HTTPS URL in your environment variables.');
        return;
    }
    
    // Update status to connecting
    statusIndicator.className = 'fas fa-circle';
    statusText.textContent = 'Connecting to Amazon Q Business...';
    
    // Create iframe for Q Business embed
    const iframe = document.createElement('iframe');
    iframe.src = qBusinessConfig.embedUrl;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: white;';
    iframe.allow = 'microphone; camera; geolocation';
    iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';
    
    // Handle iframe load events
    iframe.onload = function() {
        qBusinessLoaded = true;
        statusIndicator.className = 'fas fa-circle connected';
        statusText.textContent = 'Connected to Amazon Q Business';
        
        // Hide placeholder
        const placeholder = embedContainer.querySelector('.embed-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    };
    
    iframe.onerror = function() {
        console.error('Failed to load Q Business embed');
        showQBusinessFallback('Failed to load Amazon Q Business interface.');
    }
    
    // Clear placeholder and add iframe
    embedContainer.innerHTML = '';
    embedContainer.appendChild(iframe);
    
    // Set timeout for connection
    setTimeout(() => {
        if (!qBusinessLoaded) {
            showQBusinessFallback('Connection timeout. Please check your network and try again.');
        }
    }, 15000); // 15 second timeout
}

function showApiInterface() {
    const embedContainer = document.getElementById('qbusiness-embed');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    // Update status to connected
    statusIndicator.className = 'fas fa-circle connected';
    statusText.textContent = 'Connected to Amazon Q Business (API Mode)';
    
    // Show chat interface
    embedContainer.innerHTML = `
        <div class="qbusiness-chat-container">
            <div class="chat-messages" id="chat-messages">
                <div class="welcome-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <h3>Welcome to Amazon Q Business</h3>
                        <p>Ask questions about your financial data using natural language. I can help you analyze revenue, costs, profits, and trends across your entities.</p>
                    </div>
                </div>
            </div>
            <div class="chat-input-container">
                <form id="chat-form" class="chat-input">
                    <input type="text" id="chat-input" placeholder="Ask about your financial data..." required>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        </div>
    `;
    
    // Initialize chat functionality
    initializeChatForm();
    addSuggestedQueries();
    qBusinessLoaded = true;
}

function showQBusinessFallback(message) {
    const embedContainer = document.getElementById('qbusiness-embed');
    const fallbackContainer = document.getElementById('qbusiness-fallback');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    // Update status to error
    statusIndicator.className = 'fas fa-circle error';
    statusText.textContent = 'Connection failed';
    
    // Hide embed container and show fallback
    embedContainer.style.display = 'none';
    fallbackContainer.style.display = 'flex';
    
    // Update fallback message
    const fallbackMessage = fallbackContainer.querySelector('.fallback-message p');
    if (fallbackMessage) {
        fallbackMessage.textContent = message;
    }
}

function refreshQBusiness() {
    const embedContainer = document.getElementById('qbusiness-embed');
    const fallbackContainer = document.getElementById('qbusiness-fallback');
    
    // Reset state
    qBusinessLoaded = false;
    embedContainer.style.display = 'block';
    fallbackContainer.style.display = 'none';
    
    // Show loading placeholder
    embedContainer.innerHTML = `
        <div class="embed-placeholder">
            <div class="loading-spinner-small">
                <div class="spinner-small"></div>
            </div>
            <p>Loading Amazon Q Business...</p>
        </div>
    `;
    
    // Reload Q Business
    loadQBusinessEmbed();
}

function retryQBusiness() {
    refreshQBusiness();
}

// Legacy chat functions (kept for compatibility)
async function checkQBusinessStatus() {
    try {
        const data = await apiRequest('/qbusiness/status');
        
        if (data.success && !data.data.configured) {
            console.warn('Q Business not configured:', data.data.message);
        }
    } catch (error) {
        console.error('Q Business status error:', error);
    }
}

// Chat form handler (only add if element exists)
function initializeChatForm() {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const input = document.getElementById('chat-input');
            const query = input.value.trim();
            
            if (!query) return;
            
            // Add user message to chat
            addChatMessage('user', query);
            
            // Clear input
            input.value = '';
            
            // Add to chat history
            chatHistory.push({ role: 'user', content: query });
            
            // Show typing indicator
            const typingId = addTypingIndicator();
            
            try {
                const data = await apiRequest('/qbusiness/query', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query, conversationId: window.qBusinessConversationId })
                });
                
                // Remove typing indicator
                removeTypingIndicator(typingId);
                
                if (data.success) {
                    // Store conversation ID for follow-up questions
                    if (data.data.conversationId) {
                        window.qBusinessConversationId = data.data.conversationId;
                    }
                    
                    // Add bot response
                    addChatMessage('bot', data.data.answer);
                    
                    // Add sources if available
                    if (data.data.sources && data.data.sources.length > 0) {
                        addSourcesMessage(data.data.sources);
                    }
                    
                    // Add to chat history
                    chatHistory.push({ role: 'assistant', content: data.data.answer });
                } else {
                    addChatMessage('bot', data.data?.message || 'Sorry, I encountered an error processing your request. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Q Business query error:', error);
                removeTypingIndicator(typingId);
                addChatMessage('bot', 'Sorry, I\'m having trouble connecting right now. Please try again later.', 'error');
            }
        });
    }
}

function addChatMessage(sender, content, type = 'normal') {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender} animate__animated animate__fadeInUp`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'bot') {
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        if (type === 'warning') {
            avatarDiv.style.background = '#ffc107';
        } else if (type === 'error') {
            avatarDiv.style.background = '#dc3545';
        }
    } else {
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format content with basic markdown support
    const formattedContent = formatMessageContent(content);
    contentDiv.innerHTML = formattedContent;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

function addSourcesMessage(sources) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot sources animate__animated animate__fadeInUp';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = '<i class="fas fa-link"></i>';
    avatarDiv.style.background = '#17a2b8';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    let sourcesHtml = '<div style="margin-bottom: 10px;"><strong>Sources:</strong></div>';
    sources.forEach((source, index) => {
        sourcesHtml += `
            <div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 6px; font-size: 13px;">
                <i class="fas fa-file-alt" style="margin-right: 8px; color: #666;"></i>
                ${source.title} (${source.type})
            </div>
        `;
    });
    
    contentDiv.innerHTML = sourcesHtml;
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    const typingId = 'typing-' + Date.now();
    typingDiv.id = typingId;
    typingDiv.className = 'chat-message bot typing animate__animated animate__fadeInUp';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span style="color: #666; font-style: italic;">AI is thinking...</span>
        </div>
    `;
    
    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingId;
}

function removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
        typingDiv.remove();
    }
}

function formatMessageContent(content) {
    // Basic markdown-like formatting
    let formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>') // Code
        .replace(/\n/g, '<br>'); // Line breaks
    
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return formatted;
}

// Suggested queries
const suggestedQueries = [
    "What's our total revenue this month?",
    "Show me COGS breakdown by company",
    "Which entity has the highest revenue?",
    "Compare revenue vs COGS trends",
    "What are our top performing business units?",
    "Show me financial performance by region"
];

function addSuggestedQueries() {
    const chatMessages = document.getElementById('chat-messages');
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.className = 'suggested-queries animate__animated animate__fadeInUp';
    suggestionsDiv.style.cssText = `
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 10px;
        border-left: 4px solid #667eea;
    `;
    
    let suggestionsHtml = '<div style="margin-bottom: 10px; font-weight: 600; color: #333;"><i class="fas fa-lightbulb" style="margin-right: 8px; color: #ffc107;"></i>Try asking:</div>';
    
    suggestedQueries.forEach(query => {
        suggestionsHtml += `
            <div class="suggested-query" onclick="selectSuggestedQuery('${query}')" style="
                margin: 5px 0;
                padding: 8px 12px;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
                border: 1px solid #e1e5e9;
            " onmouseover="this.style.background='#e3f2fd'; this.style.borderColor='#667eea';" onmouseout="this.style.background='white'; this.style.borderColor='#e1e5e9';">
                ${query}
            </div>
        `;
    });
    
    suggestionsDiv.innerHTML = suggestionsHtml;
    chatMessages.appendChild(suggestionsDiv);
}

function selectSuggestedQuery(query) {
    document.getElementById('chat-input').value = query;
    document.getElementById('chat-form').dispatchEvent(new Event('submit'));
    
    // Remove suggestions after selection
    const suggestions = document.querySelector('.suggested-queries');
    if (suggestions) {
        suggestions.remove();
    }
}

// Clear chat function
function clearChat() {
    Swal.fire({
        title: 'Clear Chat',
        text: 'Are you sure you want to clear the chat history?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, clear chat'
    }).then((result) => {
        if (result.isConfirmed) {
            initializeChat();
            addSuggestedQueries();
            app.showAlert('Chat cleared', 'success');
        }
    });
}

// Add clear chat button to the chat interface
function addClearChatButton() {
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) {
        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'btn-secondary';
        clearButton.style.cssText = 'margin-left: 10px; padding: 8px 12px; font-size: 12px;';
        clearButton.innerHTML = '<i class="fas fa-trash"></i>';
        clearButton.title = 'Clear Chat';
        clearButton.onclick = clearChat;
        
        chatInput.appendChild(clearButton);
    }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat form if it exists
    initializeChatForm();
    
    // Add suggested queries on first load
    setTimeout(() => {
        const askDataPage = document.getElementById('ask-data-page');
        if (askDataPage && askDataPage.style.display !== 'none') {
            addSuggestedQueries();
        }
    }, 1000);
    
    // Add clear chat button if chat input exists
    const chatInput = document.querySelector('.chat-input');
    if (chatInput) {
        addClearChatButton();
    }
});

// Add typing dots animation CSS
const typingStyles = `
    <style>
        .typing-dots {
            display: inline-flex;
            gap: 4px;
        }
        .typing-dots span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #667eea;
            animation: typing 1.4s infinite ease-in-out;
        }
        .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
        .typing-dots span:nth-child(3) { animation-delay: 0s; }
        
        @keyframes typing {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
        }
    </style>
`;

document.head.insertAdjacentHTML('beforeend', typingStyles);

// Export Q Business functions
window.qbusiness = {
    initializeChat,
    addChatMessage,
    clearChat,
    selectSuggestedQuery
};