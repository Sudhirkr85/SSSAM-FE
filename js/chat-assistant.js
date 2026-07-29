/**
 * SSSAM CRM — AI Chat Assistant
 * Voice + Text search using Groq AI
 * Supports Hindi & English
 */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────
  // NOTE: URL is resolved at call-time (not init-time) to pick up window.API_BASE_URL
  // which is set by api.js. Hardcode Render as production fallback.
  function getApiBase() {
    return window.API_BASE_URL || 'https://crm.sssamacademy.com/api';
  }
  let selectedLang = 'hindi'; // default language
  let isListening = false;
  let recognition = null;
  let isSpeaking = false;
  let currentUtterance = null;
  function getCurrentChatUser() {
    try {
      const item = localStorage.getItem('user');
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn('Error parsing user for chat assistant', error);
      return null;
    }
  }

  function getChatWelcomeName() {
    const user = getCurrentChatUser();
    return user && user.name ? user.name.trim().split(' ')[0] : '';
  }

  // ─── Conversation State Machine ──────────────────────────────────────────
  // Tracks multi-step guided flows (note save, whatsapp confirm, etc.)
  let chatState = {
    mode: 'normal',   // 'normal' | 'awaiting_note_content' | 'awaiting_note_confirm' | 'awaiting_wa_confirm'
    data: {}          // holds temp data for the current flow
  };

  function resetState() {
    chatState = { mode: 'normal', data: {} };
  }

  // ─── Inject HTML ─────────────────────────────────────────────────────────
  function injectChatWidget() {
    const welcomeName = getChatWelcomeName();
    const welcomeTitle = welcomeName
      ? `Namaste ${welcomeName}! SSSAM AI Assistant mein aapka swagat hai`
      : 'Namaste! SSSAM AI Assistant mein aapka swagat hai';
    const html = `
      <!-- Floating Action Button -->
      <button id="chat-fab" aria-label="AI Chat Assistant" title="AI Chat Assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="chat-badge" id="chat-badge" style="display:none">!</span>
      </button>

      <!-- Chat Panel -->
      <div id="chat-panel" role="dialog" aria-label="AI Chat Assistant">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-avatar">🤖</div>
          <div class="chat-header-info">
            <h4>SSSAM AI Assistant</h4>
            <p>Groq AI • Follow-ups • Fees</p>
          </div>
          <button id="chat-fullscreen-btn" title="Full Screen" aria-label="Toggle Full Screen" style="background: transparent; border: none; color: white; cursor: pointer; padding: 4px; display: flex; align-items: center; margin-right: 8px; opacity: 0.8; transition: opacity 0.2s;">
            <svg id="fullscreen-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <div class="chat-header-status" title="Online"></div>
        </div>

        <!-- Language Toggle -->
        <div class="chat-lang-toggle">
          <span>भाषा / Language:</span>
          <button class="lang-btn active" id="lang-hindi" onclick="window.chatSetLang('hindi')">हिंदी</button>
          <button class="lang-btn" id="lang-english" onclick="window.chatSetLang('english')">English</button>
        </div>

        <!-- Quick Action Chips -->
        <div class="chat-quick-actions">
          <button class="quick-chip" onclick="window.chatSendQuick('aaj ke follow up')">📅 Today's Follow-ups</button>
          <button class="quick-chip" onclick="window.chatSendQuick('pending followups dikhao')">⏳ Pending Follow-ups</button>
          <button class="quick-chip" onclick="window.chatSendQuick('pending fees')">💰 Pending Fees</button>
          <button class="quick-chip" onclick="window.chatSendQuick('new enquiries dikhao')">🆕 New Enquiries</button>
          <button class="quick-chip" onclick="window.chatSendQuick('saved notes dikhao')">📝 Saved Notes</button>
          <button class="quick-chip" onclick="window.chatSendQuick('call kro')">📞 Call</button>
          <button class="quick-chip" onclick="window.chatSendQuick('whatsapp kro')">💬 WhatsApp</button>
          <button class="quick-chip" onclick="window.chatSendQuick('help')">📖 Guide / Help</button>
        </div>

        <!-- Messages -->
        <div id="chat-messages">
          <div class="chat-welcome">
            <span class="welcome-icon">🌟</span>
            <strong>${welcomeTitle}</strong>
            Hindi mode mein Hinglish use karo, English mode mein proper English. Aap bolkar ya likhkar data check, call/whatsapp commands aur notes save kar sakte hain.<br>
            <span class="welcome-tip">📖 "Guide / Help" chip par click karke examples dekhain!</span>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <input
            type="text"
            id="chat-input"
            placeholder="Hinglish mein puchho... jaise: aaj ke follow up dikhao"
            autocomplete="off"
            aria-label="Chat input"
          />
          <button class="chat-btn" id="chat-voice-btn" title="Voice input" aria-label="Voice input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button class="chat-btn" id="chat-send-btn" title="Send" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    bindEvents();
  }

  // ─── Event Binding ───────────────────────────────────────────────────────
  function bindEvents() {
    const fab = document.getElementById('chat-fab');
    const panel = document.getElementById('chat-panel');
    const sendBtn = document.getElementById('chat-send-btn');
    const voiceBtn = document.getElementById('chat-voice-btn');
    const input = document.getElementById('chat-input');

    // Toggle panel
    fab.addEventListener('click', () => {
      const isOpen = panel.classList.contains('open');
      panel.classList.toggle('open', !isOpen);
      fab.classList.toggle('open', !isOpen);
      document.getElementById('chat-badge').style.display = 'none';

      if (!isOpen) {
        setTimeout(() => input.focus(), 400);
      }
    });

    // Send on Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Send button
    sendBtn.addEventListener('click', sendMessage);

    // Full Screen Toggle
    const fullscreenBtn = document.getElementById('chat-fullscreen-btn');
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFullscreen = panel.classList.contains('fullscreen');
      panel.classList.toggle('fullscreen', !isFullscreen);
      
      const icon = document.getElementById('fullscreen-icon');
      if (!isFullscreen) {
        // Minimize icon
        icon.innerHTML = `<path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"/>`;
        fullscreenBtn.title = "Exit Full Screen";
      } else {
        // Maximize icon
        icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
        fullscreenBtn.title = "Full Screen";
      }
    });

    // Voice button
    voiceBtn.addEventListener('click', toggleVoice);

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !fab.contains(e.target)) {
        panel.classList.remove('open');
        fab.classList.remove('open');
        panel.classList.remove('fullscreen');
        const icon = document.getElementById('fullscreen-icon');
        if (icon) {
          icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
        }
      }
    });
  }

  // ─── Language Setting ────────────────────────────────────────────────────
  window.chatSetLang = function (lang) {
    selectedLang = lang;
    document.getElementById('lang-hindi').classList.toggle('active', lang === 'hindi');
    document.getElementById('lang-english').classList.toggle('active', lang === 'english');

    const input = document.getElementById('chat-input');
    input.placeholder = lang === 'hindi'
      ? 'Hindi ya English mein puchho...'
      : 'Type your question...';
  };

  // ─── Quick Send ──────────────────────────────────────────────────────────
  window.chatSendQuick = function (text) {
    document.getElementById('chat-input').value = text;
    sendMessage();
  };

  // ─── State: Note Save Confirm ────────────────────────────────────────────
  window.confirmNoteSave = async function () {
    const { title, content } = chatState.data;
    resetState();
    addMessage('bot', '⏳ Note save ho raha hai...');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
      await axios.post(`${getApiBase()}/chat`, {
        query: `save note ${title}: ${content}`
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
      addMessage('bot',
        `✅ **Note saved!**\n\n📌 Subject: **"${title}"**\n📝 Content: "${content}"\n\n` +
        `💡 Jab bhejnna ho bolo: *"${title} wala note dikhao"* ya *"[Student naam] ko ${title} WhatsApp karo"*`
      );
    } catch (e) {
      addMessage('bot', '❌ Save nahi ho paya. Dobara try karo.');
    }
  };

  window.editNote = function () {
    const { title } = chatState.data;
    chatState.mode = 'awaiting_note_content';
    chatState.data = { title };
    addMessage('bot', `✏️ Theek hai! **"${title}"** ke liye naya message type karo:`);
  };

  window.cancelNote = function () {
    resetState();
    addMessage('bot', '🚫 Note save cancel kar diya. Koi aur kaam ho to batao!');
  };

  window.sendWithoutSavingNote = function () {
    const { title, content } = chatState.data;
    chatState.mode = 'awaiting_wa_target';
    chatState.data = {
      noteTitle: title || 'Custom message',
      noteContent: content,
      skipSave: true
    };
    addMessage(
      'bot',
      `💬 Theek hai, bina save kiye bhejte hain.\n\nStudent ka **naam** ya **mobile number** type karo jisko WhatsApp bhejna hai 👇`
    );
  };

  // ─── State: WhatsApp Confirm ─────────────────────────────────────────────
  window.confirmWhatsAppSend = async function () {
    const { mobile, name, noteContent } = chatState.data;
    resetState();
    let cleanMobile = mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10) cleanMobile = '91' + cleanMobile;
    let waUrl = `https://wa.me/${cleanMobile}`;
    if (noteContent) waUrl += `?text=${encodeURIComponent(noteContent)}`;
    addMessage('bot',
      `✅ WhatsApp khul raha hai **${name}** ke liye!\n\n` +
      (noteContent ? `📝 Pre-filled message:\n"${noteContent}"` : `📞 Number: ${mobile}`)
    );
    setTimeout(() => window.open(waUrl, '_blank'), 500);
  };

  window.cancelWhatsApp = function () {
    resetState();
    addMessage('bot', '🚫 WhatsApp send cancel. Koi aur kaam ho to batao!');
  };

  // ─── Voice Input ─────────────────────────────────────────────────────────
  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addMessage('bot', '❌ Aapka browser voice input support nahi karta. Chrome use karo.');
      return;
    }

    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Support both Hindi and English
    recognition.lang = selectedLang === 'hindi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const voiceBtn = document.getElementById('chat-voice-btn');
    const input = document.getElementById('chat-input');

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add('listening');
      input.placeholder = '🎙️ Sun raha hoon...';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      input.value = transcript;
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove('listening');
      input.placeholder = selectedLang === 'hindi'
        ? 'Hinglish mein puchho... jaise: pending fees dikhao'
        : 'Ask in proper English...';

      // Auto-send if we got something
      if (input.value.trim()) {
        sendMessage();
      }
    };

    recognition.onerror = (event) => {
      isListening = false;
      voiceBtn.classList.remove('listening');
      input.placeholder = 'Type karo ya mic click karo...';

      if (event.error === 'no-speech') {
        addMessage('bot', '🎙️ Kuch nahi suna. Phir se try karo.');
      } else if (event.error === 'not-allowed') {
        addMessage('bot', '❌ Microphone access allow karo browser settings mein.');
      }
    };

    recognition.start();
  }

  function stopListening() {
    if (recognition) {
      recognition.stop();
    }
  }

  // ─── Text-to-Speech ──────────────────────────────────────────────────────
  function speakText(text, lang) {
    if (!('speechSynthesis' in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    // Clean text for TTS (remove markdown, emojis partially)
    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/\n/g, '. ')
      .substring(0, 500); // limit length for TTS

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === 'hindi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    currentUtterance = utterance;
    isSpeaking = true;

    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = () => { isSpeaking = false; };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
    }
  }

  // ─── Send Message (State Router) ─────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    if (!query) return;

    addMessage('user', query);
    input.value = '';

    // ── Route based on current conversation state ──
    if (chatState.mode === 'awaiting_note_title') {
      return handleNoteTitle(query);
    }
    if (chatState.mode === 'awaiting_note_content') {
      return handleNoteContent(query);
    }
    if (chatState.mode === 'awaiting_note_confirm_edit') {
      return handleNoteConfirmEdit(query);
    }
    if (chatState.mode === 'awaiting_wa_target') {
      return handleWaTarget(query);
    }

    // ── Detect local intents before API call ──
    const lower = query.toLowerCase();
    const isSaveIntent = /\b(save|store|note|template|message|message save|note save|save kro|save karna|likhna|note banana)\b/.test(lower);
    const isShowNoteIntent = /\b(dikhao|show|notes|templates|saved|dekho|search note|dhundho)\b/.test(lower) && /\b(note|template|message|msg)\b/.test(lower);

    if (isSaveIntent && !isShowNoteIntent) {
      return startSaveNoteFlow();
    }

    // ── Normal API call ──
    await callChatApi(query);
  }

  // ─── Save Note: Step 1 — Ask subject ────────────────────────────────────
  function startSaveNoteFlow() {
    chatState.mode = 'awaiting_note_title';
    chatState.data = {};
    addMessage('bot',
      `📝 **Note/Template save karte hain!**\n\n` +
      `Pehle mujhe **subject / title** batao — jaise:\n` +
      `• *Admission message*\n• *Fee reminder*\n• *Batch timing*\n• *Discount offer*\n\n` +
      `Koi bhi naam de do jisse baad mein yaad aaye 👇`
    );
  }

  // ─── Save Note: Step 2 — Got title, ask content ──────────────────────────
  function handleNoteTitle(title) {
    chatState.data.title = title;
    chatState.mode = 'awaiting_note_content';
    addMessage('bot',
      `👍 Subject: **"${title}"**\n\n` +
      `Ab poora **message / content** type karo jo save karna hai 👇\n\n` +
      `_(Example: "Aapka admission ho gaya hai. Fees 6000 hai. Pehle din 15 July ko aaiye.")_`
    );
  }

  // ─── Save Note: Step 3 — Got content, show preview + confirm ─────────────
  function handleNoteContent(content) {
    chatState.data.content = content;
    chatState.mode = 'awaiting_note_confirm_edit';
    const { title } = chatState.data;
    addMessage('bot',
      `📋 **Preview — Note ready hai:**\n\n` +
      `🏷️ Subject: **"${title}"**\n` +
      `📄 Content:\n_"${content}"_\n\n` +
      `Isko save karun ya edit karna hai?`,
      false, selectedLang, null,
      [
        { label: '✅ Haan, Save Karo!', action: 'confirmNoteSave()' },
        { label: '✏️ Edit Karna Hai', action: 'editNote()' },
        { label: '💬 Save Bina Bhejo', action: 'sendWithoutSavingNote()' },
        { label: '❌ Cancel', action: 'cancelNote()' }
      ]
    );
  }

  // ─── Save Note: Step 4 — Handle typed confirm/edit ───────────────────────
  function handleNoteConfirmEdit(query) {
    const lower = query.toLowerCase();
    if (/^(haan|ha|yes|save|kar do|theek|ok|bilkul|confirm)/.test(lower)) {
      window.confirmNoteSave();
    } else if (/^(bhejo|bhj do|send|send now|whatsapp|abhi bhejo)/.test(lower)) {
      window.sendWithoutSavingNote();
    } else if (/^(edit|badlo|change|nahi|no|cancel)/.test(lower)) {
      if (/cancel|nahi|no/.test(lower)) {
        window.cancelNote();
      } else {
        window.editNote();
      }
    } else {
      // Treat typed text as new content
      chatState.data.content = query;
      chatState.mode = 'awaiting_note_confirm_edit';
      const { title } = chatState.data;
      addMessage('bot',
        `📋 **Updated Preview:**\n\n🏷️ Subject: **"${title}"**\n📄 Content:\n_"${query}"_\n\nAb save karun?`,
        false, selectedLang, null,
        [
          { label: '✅ Save Karo!', action: 'confirmNoteSave()' },
          { label: '✏️ Phir Edit', action: 'editNote()' },
          { label: '💬 Save Bina Bhejo', action: 'sendWithoutSavingNote()' },
          { label: '❌ Cancel', action: 'cancelNote()' }
        ]
      );
    }
  }

  // ─── WhatsApp: Ask for target after note shown ────────────────────────────
  window.startWhatsAppFromNote = function(noteTitle, noteContent) {
    chatState.mode = 'awaiting_wa_target';
    chatState.data = { noteTitle, noteContent };
    addMessage('bot',
      `💬 Kisko **WhatsApp** karna hai?\n\nStudent ka **naam** ya **mobile number** type karo 👇`
    );
  };

  // ─── WhatsApp: Look up student, show confirm ─────────────────────────────
  async function handleWaTarget(query) {
    const { noteContent } = chatState.data;
    const typingId = showTyping();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
      const response = await axios.post(`${getApiBase()}/chat`, {
        query: `whatsapp ${query}`
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
      removeTyping(typingId);

      if (response.data.success) {
        const action = response.data.data.action;
        if (action && action.mobile) {
          // We have a student — show WhatsApp confirm
          chatState.mode = 'awaiting_wa_confirm';
          chatState.data = {
            mobile: action.mobile,
            name: action.name,
            noteContent: noteContent || action.text
          };
          addMessage('bot',
            `✅ Mila! **${action.name}** — 📱 ${action.mobile}\n\n` +
            (noteContent ? `📝 Message:\n_"${noteContent}"_\n\n` : '') +
            `Inhe WhatsApp karu?`,
            false, selectedLang, null,
            [
              { label: `💬 Haan, WhatsApp Karo!`, action: 'confirmWhatsAppSend()' },
              { label: '❌ Cancel', action: 'cancelWhatsApp()' }
            ]
          );
        } else {
          resetState();
          addMessage('bot', response.data.data.message || '❌ Contact nahi mila.');
        }
      } else {
        resetState();
        addMessage('bot', '❌ Contact dhundh nahi paya. Sahi naam ya number do.');
      }
    } catch (e) {
      removeTyping(typingId);
      resetState();
      addMessage('bot', '⚠️ Server error. Dobara try karo.');
    }
  }

  // ─── Normal API Call ─────────────────────────────────────────────────────
  async function callChatApi(query) {
    const typingId = showTyping();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    if (!token) {
      removeTyping(typingId);
      addMessage('bot', '❌ Login session expire ho gayi. Please reload karke dobara login karo.');
      return;
    }

    try {
      const response = await axios.post(`${getApiBase()}/chat`, {
        query,
        language: selectedLang,
        inputMode: selectedLang === 'hindi' ? 'hinglish' : 'english',
        responseStyle: selectedLang === 'hindi'
          ? 'Understand Hinglish typed in English letters and reply in natural Hindi using English letters unless the user asks otherwise.'
          : 'Reply in clear, proper English.'
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      removeTyping(typingId);

      if (response.data.success) {
        const { message, language, action, rawData } = response.data.data;
        const lang = language || selectedLang;

        // If backend returned notes list, show with WhatsApp buttons
        if (action && action.type === 'notes_list' && action.notes) {
          addMessage('bot', message, true, lang);
          action.notes.forEach(note => {
            addNoteCard(note);
          });
        } else {
          addMessage('bot', message, true, lang, action);
          if (rawData) {
            addLeadCards(rawData);
          }
        }
      } else {
        addMessage('bot', '⚠️ Kuch gadbad hui. Dobara try karo.');
      }
    } catch (error) {
      removeTyping(typingId);
      let errorMsg = '⚠️ Server se connect nahi ho pa raha.';
      if (error.response) {
        if (error.response.status === 401) errorMsg = '❌ Login session expire. Reload karke login karo.';
        else if (error.response.status === 400) errorMsg = `❌ ${error.response.data?.message || 'Invalid query.'}`;
        else if (error.response.status === 500) errorMsg = '⚠️ Server error. Thodi der baad try karo.';
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = '⏱️ Response time out. Dobara try karo.';
      }
      addMessage('bot', errorMsg);
    }
  }

  // ─── Note Card (with WhatsApp button) ───────────────────────────────────
  function addNoteCard(note) {
    const messages = document.getElementById('chat-messages');
    const card = document.createElement('div');
    card.className = 'chat-msg bot';
    const titleEsc = escapeHtml(note.title || 'General');
    const contentEsc = escapeHtml(note.content || '');
    const safeTitle = (note.title || 'General').replace(/'/g, "\\'");
    const safeContent = (note.content || '').replace(/'/g, "\\'");
    card.innerHTML = `
      <div class="msg-bubble note-card">
        <div class="note-card-header">📌 <strong>${titleEsc}</strong></div>
        <div class="note-card-body">${contentEsc}</div>
        <div class="note-card-actions">
          <button class="msg-action-btn whatsapp-btn" onclick="window.startWhatsAppFromNote('${safeTitle}', '${safeContent}')">
            💬 WhatsApp Bhejo
          </button>
        </div>
      </div>
    `;
    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  // ─── Lead / Student Card Box (with Call & WhatsApp buttons) ────────────────
  function addLeadCards(rawData) {
    if (!rawData) return;
    const items = [];

    if (Array.isArray(rawData.enquiries)) {
      rawData.enquiries.forEach(e => {
        if (e && e.mobile) {
          items.push({
            name: e.name || 'Enquiry',
            mobile: e.mobile,
            course: e.course || '',
            status: e.status || 'NEW',
            extra: e.followUpDate ? `Follow-up: ${e.followUpDate}` : ''
          });
        }
      });
    }

    if (Array.isArray(rawData.admissions)) {
      rawData.admissions.forEach(a => {
        if (a && a.mobile) {
          items.push({
            name: a.name || 'Student',
            mobile: a.mobile,
            course: a.course || '',
            status: a.status || 'ACTIVE',
            extra: a.pendingAmount != null ? `Pending Fee: ₹${a.pendingAmount}` : ''
          });
        }
      });
    }

    if (Array.isArray(rawData.followups)) {
      rawData.followups.forEach(f => {
        if (f && f.mobile) {
          items.push({
            name: f.name || 'Lead',
            mobile: f.mobile,
            course: f.course || '',
            status: f.status || 'PENDING',
            extra: f.followUpTime ? `Time: ${f.followUpTime}` : ''
          });
        }
      });
    }

    if (Array.isArray(rawData.students)) {
      rawData.students.forEach(s => {
        if (s && s.mobile) {
          items.push({
            name: s.name || 'Student',
            mobile: s.mobile,
            course: s.course || '',
            status: 'PENDING FEE',
            extra: `Pending Dues: ₹${s.pendingAmount}`
          });
        }
      });
    }

    if (rawData.type === 'mobile_search') {
      if (rawData.admission && rawData.admission.mobile) {
        items.push({
          name: rawData.admission.name || 'Student',
          mobile: rawData.admission.mobile,
          course: rawData.admission.course || '',
          status: rawData.admission.status || 'ACTIVE',
          extra: `Pending Fee: ₹${rawData.admission.pendingAmount || 0}`
        });
      }
      if (rawData.enquiry && rawData.enquiry.mobile) {
        items.push({
          name: rawData.enquiry.name || 'Enquiry',
          mobile: rawData.enquiry.mobile,
          course: rawData.enquiry.course || '',
          status: rawData.enquiry.status || 'NEW',
          extra: rawData.enquiry.followUpDate ? `Follow-up: ${rawData.enquiry.followUpDate}` : ''
        });
      }
    }

    if (items.length === 0) return;

    const messages = document.getElementById('chat-messages');
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'chat-msg bot';
      const cleanMobile = (item.mobile || '').toString().replace(/\D/g, '');
      const waMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
      const nameEsc = escapeHtml(item.name);
      const courseEsc = escapeHtml(item.course);
      const statusEsc = escapeHtml(item.status);
      const extraEsc = escapeHtml(item.extra);

      const notesHtml = Array.isArray(item.recentNotes) && item.recentNotes.length > 0
        ? `<div style="margin-top: 8px; padding: 8px 10px; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 6px; font-size: 11.5px; color: #334155;">
             <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
               📜 Recent Timeline Notes (Last ${item.recentNotes.length}):
             </div>
             ${item.recentNotes.map(n => `
               <div style="margin-bottom: 3px;">
                 • <span style="font-weight: 600; color: #0f172a;">${escapeHtml(n.note || n.text || '')}</span>
                 ${n.date ? `<span style="color: #94a3b8; font-size: 10px;"> (${escapeHtml(n.date)})</span>` : ''}
               </div>
             `).join('')}
           </div>`
        : '';

      card.innerHTML = `
        <div class="msg-bubble lead-card" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 14px; margin-top: 8px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); color: #0f172a; font-family: inherit;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; color: #0f172a; margin-bottom: 6px;">
            <span>👤 ${nameEsc}</span>
            <span style="background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; border: 1px solid #bfdbfe;">${statusEsc}</span>
          </div>
          ${courseEsc ? `<div style="font-size: 12.5px; color: #334155; font-weight: 600; margin-bottom: 4px;">🎓 Course: <span style="color: #0f172a;">${courseEsc}</span></div>` : ''}
          ${extraEsc ? `<div style="font-size: 12.5px; color: #ea580c; font-weight: 700; margin-bottom: 6px; background: #fff7ed; padding: 4px 8px; border-radius: 6px; border: 1px solid #ffedd5; display: inline-block;">ℹ️ ${extraEsc}</div>` : ''}
          ${notesHtml}
          <div style="display: flex; gap: 10px; margin-top: 12px;">
            <a href="tel:${cleanMobile}" style="flex: 1; text-align: center; text-decoration: none; background: #2563eb; color: #ffffff; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); transition: all 0.2s;">
              📞 Call Now
            </a>
            <a href="https://wa.me/${waMobile}" target="_blank" style="flex: 1; text-align: center; text-decoration: none; background: #16a34a; color: #ffffff; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2); transition: all 0.2s;">
              💬 WhatsApp
            </a>
          </div>
        </div>
      `;
      messages.appendChild(card);
    });
    messages.scrollTop = messages.scrollHeight;
  }

  // ─── Add Message to Chat ─────────────────────────────────────────────────
  function addMessage(role, text, withSpeakBtn = false, lang = selectedLang, action = null, confirmButtons = null) {
    const messages = document.getElementById('chat-messages');

    // Remove welcome message on first real message
    const welcome = messages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;

    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const bubbleText = escapeHtml(text);
    const timeEl = `<span class="msg-time">${time}</span>`;

    let speakBtnHtml = '';
    if (withSpeakBtn && role === 'bot') {
      const escapedForAttr = text.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
      speakBtnHtml = `<button class="speak-btn" onclick="window.chatSpeak('${escapedForAttr}', '${lang}')" title="Isko sunao">🔊 Sunao</button>`;
    }

    // Confirm/Action Buttons (for multi-step flows)
    let confirmBtnsHtml = '';
    if (confirmButtons && confirmButtons.length) {
      confirmBtnsHtml = `<div class="msg-confirm-buttons">` +
        confirmButtons.map(btn =>
          `<button class="msg-confirm-btn" onclick="window.${btn.action}">${btn.label}</button>`
        ).join('') +
        `</div>`;
    }

    let actionBtnHtml = '';
    if (action && action.mobile) {
      if (action.type === 'call') {
        actionBtnHtml = `
          <div class="msg-action-container">
            <a href="tel:${action.mobile}" class="msg-action-btn call-btn">
              <span style="font-size: 16px; margin-right: 6px;">📞</span> Call ${action.name || 'Student'}
            </a>
          </div>
        `;
      } else if (action.type === 'whatsapp') {
        // Remove leading 91 or +91 if present for wa.me formatting
        let cleanMobile = action.mobile.replace(/\D/g, '');
        if (cleanMobile.length === 10) {
          cleanMobile = '91' + cleanMobile;
        }
        let waUrl = `https://wa.me/${cleanMobile}`;
        if (action.text) {
          waUrl += `?text=${encodeURIComponent(action.text)}`;
        }
        actionBtnHtml = `
          <div class="msg-action-container">
            <a href="${waUrl}" target="_blank" class="msg-action-btn whatsapp-btn">
              <span style="font-size: 16px; margin-right: 6px;">💬</span> WhatsApp ${action.name || 'Student'}
            </a>
          </div>
        `;
      }
    }


    msg.innerHTML = `
      <div class="msg-bubble">
        ${bubbleText}
        ${confirmBtnsHtml}
        ${actionBtnHtml}
      </div>
      ${timeEl}
      ${speakBtnHtml}
    `;

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  // ─── Speak button handler ────────────────────────────────────────────────
  window.chatSpeak = function (text, lang) {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speakText(text, lang || selectedLang);
    }
  };

  // ─── Typing Indicator ────────────────────────────────────────────────────
  function showTyping() {
    const messages = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();

    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = id;
    typing.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;

    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    // Inject CSS if not already loaded
    if (!document.getElementById('chat-assistant-css')) {
      const link = document.createElement('link');
      link.id = 'chat-assistant-css';
      link.rel = 'stylesheet';
      link.href = './css/chat-assistant.css';
      document.head.appendChild(link);
    }

    // Inject HTML widget
    injectChatWidget();

    // Show badge after 3 seconds to grab attention
    setTimeout(() => {
      const badge = document.getElementById('chat-badge');
      if (badge) badge.style.display = 'flex';
    }, 3000);
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
