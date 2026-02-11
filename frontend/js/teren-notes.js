// teren-notes.js — Note private pe terenuri favorite (profile page)
// Requires: supabase client as `sb`, current user available

(function() {
    'use strict';

    // Wait for the favorite terrains to be rendered, then attach notes
    // We use a MutationObserver to detect when terrains are loaded
    const NOTES_TABLE = 'user_teren_notes';

    let currentUserId = null;
    let isOwnProfile = false;

    // Initialize after DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for profile-view-new.js to load user data
        setTimeout(initNotes, 500);
    });

    async function initNotes() {
        try {
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return; // Not logged in, no notes

            currentUserId = user.id;

            // Check if viewing own profile
            const params = new URLSearchParams(window.location.search);
            const profileId = params.get('id');
            isOwnProfile = !profileId || profileId === currentUserId;

            if (!isOwnProfile) return; // Notes are private, only show on own profile

            // Watch for favorite terrains to be rendered
            observeFavoriteTerrains();
        } catch (e) {
            console.error('Notes init error:', e);
        }
    }

    function observeFavoriteTerrains() {
        const container = document.getElementById('favorite-terrains');
        if (!container) return;

        // Check if already populated with terrain cards (links to teren-details)
        const existingLinks = container.querySelectorAll('a[href*="teren-details"]');
        if (existingLinks.length > 0) {
            attachNotesToTerrains(container);
            return;
        }

        // Otherwise observe for changes
        const observer = new MutationObserver(() => {
            const links = container.querySelectorAll('a[href*="teren-details"]');
            if (links.length > 0) {
                observer.disconnect();
                attachNotesToTerrains(container);
            }
        });

        observer.observe(container, { childList: true, subtree: true });
    }

    async function attachNotesToTerrains(container) {
        // Find all terrain cards - each should have a link with teren ID
        const terenLinks = container.querySelectorAll('a[href*="teren-details"]');
        const terenIds = [];

        terenLinks.forEach(link => {
            const url = new URL(link.href, window.location.origin);
            const id = url.searchParams.get('id');
            if (id) terenIds.push(id);
        });

        if (terenIds.length === 0) return;

        // Load all notes for these terrains in one query
        let notesMap = {};
        try {
            const { data, error } = await sb
                .from(NOTES_TABLE)
                .select('id, teren_id, content, updated_at')
                .eq('user_id', currentUserId)
                .in('teren_id', terenIds);

            if (error) throw error;

            (data || []).forEach(n => {
                notesMap[n.teren_id] = n;
            });
        } catch (e) {
            console.error('Load notes error:', e);
        }

        // Inject note UI after each terrain card
        terenLinks.forEach(link => {
            const url = new URL(link.href, window.location.origin);
            const terenId = url.searchParams.get('id');
            if (!terenId) return;

            // Find the parent card element (the <a> or its container)
            const card = link.closest('.flex, [class*="border"]') || link.parentElement;
            if (!card) return;

            // Don't add twice
            if (card.parentElement.querySelector('.teren-note-section[data-teren="' + terenId + '"]')) return;

            const note = notesMap[terenId] || null;
            const noteEl = createNoteElement(terenId, note);
            
            // Insert after the card
            card.after(noteEl);
        });
    }

    function createNoteElement(terenId, existingNote) {
        const section = document.createElement('div');
        section.className = 'teren-note-section';
        section.setAttribute('data-teren', terenId);

        const hasNote = existingNote && existingNote.content;

        section.innerHTML = `
            <div class="teren-note-wrapper">
                <div class="teren-note-header">
                    <span class="teren-note-label">
                        <i class="fas fa-sticky-note"></i> Nota mea
                    </span>
                    ${hasNote ? `<span class="teren-note-time">${timeAgo(existingNote.updated_at)}</span>` : ''}
                </div>
                <div class="teren-note-display ${hasNote ? '' : 'hidden'}" id="note-display-${terenId}">
                    <p class="teren-note-text">${hasNote ? escapeHtml(existingNote.content) : ''}</p>
                    <div class="teren-note-actions">
                        <button class="note-btn-edit" onclick="window._terenNotes.editNote('${terenId}')" title="Editeaza">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="note-btn-delete" onclick="window._terenNotes.deleteNote('${terenId}', '${existingNote ? existingNote.id : ''}')" title="Sterge nota">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="teren-note-editor ${hasNote ? 'hidden' : ''}" id="note-editor-${terenId}">
                    <textarea id="note-input-${terenId}" placeholder="Adauga o nota privata despre acest teren..." maxlength="5000" rows="2">${hasNote ? escapeHtml(existingNote.content) : ''}</textarea>
                    <div class="teren-note-editor-actions">
                        ${hasNote ? `<button class="note-btn-cancel" onclick="window._terenNotes.cancelEdit('${terenId}')">Anuleaza</button>` : ''}
                        <button class="note-btn-save" onclick="window._terenNotes.saveNote('${terenId}', '${existingNote ? existingNote.id : ''}')">
                            <i class="fas fa-check"></i> Salveaza
                        </button>
                    </div>
                </div>
            </div>
        `;

        return section;
    }

    // ── PUBLIC API (exposed on window) ──

    window._terenNotes = {
        editNote: function(terenId) {
            const display = document.getElementById('note-display-' + terenId);
            const editor = document.getElementById('note-editor-' + terenId);
            if (display) display.classList.add('hidden');
            if (editor) {
                editor.classList.remove('hidden');
                const textarea = document.getElementById('note-input-' + terenId);
                if (textarea) textarea.focus();
            }
        },

        cancelEdit: function(terenId) {
            const display = document.getElementById('note-display-' + terenId);
            const editor = document.getElementById('note-editor-' + terenId);
            if (display) display.classList.remove('hidden');
            if (editor) editor.classList.add('hidden');
        },

        saveNote: async function(terenId, existingId) {
            const textarea = document.getElementById('note-input-' + terenId);
            if (!textarea) return;

            const content = textarea.value.trim();
            if (!content) return;

            textarea.disabled = true;
            const section = document.querySelector('.teren-note-section[data-teren="' + terenId + '"]');

            try {
                let result;
                if (existingId) {
                    // Update existing note
                    result = await sb
                        .from(NOTES_TABLE)
                        .update({ content: content, updated_at: new Date().toISOString() })
                        .eq('id', existingId)
                        .select()
                        .single();
                } else {
                    // Insert new note
                    result = await sb
                        .from(NOTES_TABLE)
                        .insert({
                            user_id: currentUserId,
                            teren_id: terenId,
                            content: content
                        })
                        .select()
                        .single();
                }

                if (result.error) throw result.error;

                // Re-render the note section
                const newNote = result.data;
                const newEl = createNoteElement(terenId, newNote);
                if (section) section.replaceWith(newEl);

            } catch (e) {
                console.error('Save note error:', e);
                alert('Eroare la salvarea notei.');
            } finally {
                textarea.disabled = false;
            }
        },

        deleteNote: async function(terenId, noteId) {
            if (!noteId) return;
            if (!confirm('Stergi nota?')) return;

            try {
                const { error } = await sb
                    .from(NOTES_TABLE)
                    .delete()
                    .eq('id', noteId);

                if (error) throw error;

                // Re-render as empty
                const section = document.querySelector('.teren-note-section[data-teren="' + terenId + '"]');
                const newEl = createNoteElement(terenId, null);
                if (section) section.replaceWith(newEl);

            } catch (e) {
                console.error('Delete note error:', e);
                alert('Eroare la stergerea notei.');
            }
        }
    };

    // ── HELPERS ──

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function timeAgo(dateStr) {
        if (!dateStr) return '';
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'acum';
        if (mins < 60) return `acum ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `acum ${hrs}h`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `acum ${days}z`;
        const months = Math.floor(days / 30);
        return `acum ${months} luni`;
    }

})();
