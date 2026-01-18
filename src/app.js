// Nervous in Church - v0.1
// A quiet room for legal writing

(function() {
  'use strict';

  // State
  let currentContent = '';
  let currentPath = null;
  let isDirty = false;
  let showExportDialog = false;

  // YAML Frontmatter helpers
  function generateFrontmatter(title = 'Untitled') {
    const now = new Date().toISOString();
    return `---
title: "${title}"
created: ${now}
modified: ${now}
tags: []
---

`;
  }

  function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      return {
        frontmatter: match[1],
        body: match[2]
      };
    }
    return { frontmatter: null, body: content };
  }

  function updateFrontmatterModified(content) {
    const { frontmatter, body } = parseFrontmatter(content);
    if (frontmatter) {
      const now = new Date().toISOString();
      const updatedFm = frontmatter.replace(/modified:.*/, `modified: ${now}`);
      return `---\n${updatedFm}\n---\n${body}`;
    }
    return content;
  }

  function getContentWithFrontmatter() {
    const { frontmatter } = parseFrontmatter(currentContent);
    if (!frontmatter) {
      // Add frontmatter if missing
      const title = currentPath ? currentPath.split('/').pop().replace('.md', '') : 'Untitled';
      return generateFrontmatter(title) + currentContent;
    }
    return updateFrontmatterModified(currentContent);
  }

  function getDisplayContent() {
    const { body } = parseFrontmatter(currentContent);
    return body;
  }

  // Render function
  function render() {
    const root = document.getElementById('root');
    const titleText = currentPath ? currentPath.split('/').pop() : 'Untitled';
    const dirtyMarker = isDirty ? ' *' : '';

    root.innerHTML = `
      <div class="titlebar">
        <span class="titlebar-title">${titleText}${dirtyMarker}</span>
      </div>
      <div class="editor-container">
        <div class="editor">
          <textarea
            class="editor-textarea"
            placeholder="Start writing..."
            spellcheck="false"
          >${escapeHtml(getDisplayContent())}</textarea>
        </div>
      </div>
      ${showExportDialog ? renderExportDialog() : ''}
    `;

    // Attach event listeners
    const textarea = root.querySelector('.editor-textarea');
    textarea.addEventListener('input', handleInput);

    // Set cursor position at end
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Export dialog buttons
    if (showExportDialog) {
      document.querySelector('.btn-export-docx').addEventListener('click', () => exportAs('docx'));
      document.querySelector('.btn-export-pdf').addEventListener('click', () => exportAs('pdf'));
      document.querySelector('.btn-export-cancel').addEventListener('click', closeExportDialog);
    }
  }

  function renderExportDialog() {
    return `
      <div class="dialog-overlay" onclick="closeExportDialog(event)">
        <div class="dialog" onclick="event.stopPropagation()">
          <div class="dialog-title">Export Document</div>
          <div class="dialog-buttons">
            <button class="dialog-btn dialog-btn-primary btn-export-docx">Word (.docx)</button>
            <button class="dialog-btn dialog-btn-primary btn-export-pdf">PDF (.pdf)</button>
          </div>
          <div class="dialog-buttons" style="margin-top: 12px;">
            <button class="dialog-btn dialog-btn-secondary btn-export-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Event handlers
  function handleInput(e) {
    const { frontmatter } = parseFrontmatter(currentContent);
    if (frontmatter) {
      currentContent = `---\n${frontmatter}\n---\n${e.target.value}`;
    } else {
      currentContent = e.target.value;
    }
    isDirty = true;
    updateTitle();
  }

  function updateTitle() {
    const titleEl = document.querySelector('.titlebar-title');
    if (titleEl) {
      const titleText = currentPath ? currentPath.split('/').pop() : 'Untitled';
      const dirtyMarker = isDirty ? ' *' : '';
      titleEl.textContent = titleText + dirtyMarker;
    }
  }

  // File operations
  async function newFile() {
    currentContent = '';
    currentPath = null;
    isDirty = false;
    render();
  }

  async function saveFile(saveAs = false) {
    const content = getContentWithFrontmatter();
    const result = await window.electronAPI.saveFile(content, saveAs);
    if (result.success) {
      currentPath = result.path;
      currentContent = content;
      isDirty = false;
      updateTitle();
    }
  }

  function openExportDialog() {
    showExportDialog = true;
    render();
  }

  function closeExportDialog(e) {
    if (e && e.target !== e.currentTarget) return;
    showExportDialog = false;
    render();
  }

  async function exportAs(format) {
    const content = getContentWithFrontmatter();
    const result = await window.electronAPI.exportFile(content, format);
    if (result.success) {
      showExportDialog = false;
      render();
    } else if (result.error) {
      alert('Export failed: ' + result.error);
    }
    showExportDialog = false;
    render();
  }

  function handleFileOpened(data) {
    currentContent = data.content;
    currentPath = data.path;
    isDirty = false;
    render();
  }

  // Make closeExportDialog globally accessible for onclick
  window.closeExportDialog = closeExportDialog;

  // Initialize
  function init() {
    render();

    // Listen for menu commands
    window.electronAPI.onFileNew(() => newFile());
    window.electronAPI.onFileOpened(handleFileOpened);
    window.electronAPI.onFileSave(() => saveFile(false));
    window.electronAPI.onFileSaveAs(() => saveFile(true));
    window.electronAPI.onFileExport(() => openExportDialog());
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
