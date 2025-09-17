// Markdown rendering utilities
// Simple markdown renderer for full content
function renderMarkdown(text) {
    if (!text) return '';
    
    return text
        // Headers (process in order from most specific to least)
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold (must come before italic)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic (simplified regex for better compatibility)
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>');
}

// Simple markdown renderer for short snippets (strips line breaks to avoid tall cards)
function renderMarkdownSnippet(text) {
    if (!text) return '';
    
    const html = text
        // Headers (convert to bold for snippets)
        .replace(/^### (.*$)/gim, '<strong>$1</strong>')
        .replace(/^## (.*$)/gim, '<strong>$1</strong>')
        .replace(/^# (.*$)/gim, '<strong>$1</strong>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Code blocks (convert to inline code for snippets)
        .replace(/```([\s\S]*?)```/g, '<code>$1</code>')
        // Replace line breaks with spaces for compact display
        .replace(/\n/g, ' ');
    
    return html;
}

// Helper function to render markdown content into an element with proper styling
function renderMarkdownToElement(elementId, markdownText, fallbackText = '') {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id '${elementId}' not found`);
        return;
    }
    
    try {
        if (markdownText && markdownText.trim()) {
            const renderedHtml = renderMarkdown(markdownText);
            element.innerHTML = renderedHtml;
            // Ensure the element has the markdown-content class for proper styling
            element.classList.add('markdown-content');
        } else {
            element.textContent = fallbackText;
        }
    } catch (error) {
        console.error('Error rendering markdown:', error);
        element.textContent = markdownText || fallbackText;
    }
}
