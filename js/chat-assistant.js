/**
 * SSSAM CRM — AI Chat Assistant
 * Voice + Text search using Groq AI
 * Supports Hindi & English
 */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────
  function getApiBase() {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' || 
      window.location.hostname === ''
    );
    return isLocal ? 'http://localhost:5000/api' : 'https://crm.sssamacademy.com/api';
  }
  let selectedLang = 'hindi'; // default language: Hindi
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

  function isAdminUser() {
    const user = getCurrentChatUser();
    if (user && user.role) {
      const r = user.role.toLowerCase();
      return r === 'admin' || r === 'superadmin';
    }
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.role) {
          const r = payload.role.toLowerCase();
          return r === 'admin' || r === 'superadmin';
        }
      }
    } catch (_) {}
    return false;
  }

  function getTimeBasedGreeting(userName) {
    const hour = new Date().getHours();
    let salutation = 'Good Morning';
    let icon = '🌅';
    if (hour >= 12 && hour < 17) {
      salutation = 'Good Afternoon';
      icon = '☀️';
    } else if (hour >= 17 && hour < 22) {
      salutation = 'Good Evening';
      icon = '🌆';
    } else if (hour >= 22 || hour < 5) {
      salutation = 'Hello';
      icon = '🌙';
    }

    const namePart = userName ? ` ${userName}` : '';
    return {
      title: `${salutation}${namePart}! ${icon}`,
      desc: `Main aapki <strong>Jiya AI</strong> assistant hoon. Aap mujhse <strong>bolkar 🎙️</strong> ya <strong>likhkar 💬</strong> puch sakte hain. Aapko aaj kya jankari chahiye ya kaunsa kaam karna hai?`
    };
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
    const greeting = getTimeBasedGreeting(welcomeName);
    const admin = isAdminUser();

    const html = `
      <!-- Floating Action Button -->
      <button id="chat-fab" aria-label="Jiya AI Assistant" title="Jiya AI Assistant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="chat-badge" id="chat-badge" style="display:none">!</span>
      </button>

      <!-- Chat Panel -->
      <div id="chat-panel" role="dialog" aria-label="Jiya AI Assistant">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-avatar">🤖</div>
          <div class="chat-header-info">
            <h4>Jiya AI Assistant</h4>
            <p>● Online • Aapki Personal Assistant</p>
          </div>
          <div class="chat-lang-pill-toggle">
            <button class="lang-pill active" id="lang-hindi" onclick="window.chatSetLang('hindi')">HI</button>
            <button class="lang-pill" id="lang-english" onclick="window.chatSetLang('english')">EN</button>
          </div>
          <button id="chat-fullscreen-btn" title="Full Screen" aria-label="Toggle Full Screen" style="background: transparent; border: none; color: white; cursor: pointer; padding: 4px; display: flex; align-items: center; margin-left: 4px; opacity: 0.85; transition: opacity 0.2s;">
            <svg id="fullscreen-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>

        <!-- Quick Action Chips -->
        <div class="chat-quick-actions">
          <button class="quick-chip chip-overview" onclick="window.chatSendQuick('CRM Overview')">📊 Overview</button>
          <button class="quick-chip chip-followup" onclick="window.chatSendQuick('Today followups')">📅 Today Follow-ups</button>
          <button class="quick-chip chip-fee" onclick="window.chatSendQuick('Pending fees')">💰 Pending Fees</button>
          <button class="quick-chip" onclick="window.chatSendQuick('Interested leads')">⭐ Interested Leads</button>
          <button class="quick-chip" onclick="window.chatSendQuick('New enquiries')">🆕 New Enquiries</button>
          <button class="quick-chip" onclick="window.chatSendQuick('Draft message')">✍️ Draft Message</button>
          ${admin ? `<button class="quick-chip" onclick="window.chatSendQuick('Staff attendance')">📋 Staff Attendance</button>` : ''}
          <button class="quick-chip" style="background:linear-gradient(135deg,#8b5cf6,#6366f1);color:#fff;font-weight:700;" onclick="window.chatSendQuick('Nayi enquiry add karo')">➕ New Enquiry</button>
          <button class="quick-chip" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-weight:700;" onclick="window.chatSendQuick('Direct admission karna hai')">🎓 Direct Admission</button>
        </div>

        <!-- Messages -->
        <div id="chat-messages">
          <div class="chat-welcome">
            <div class="chat-welcome-header">
              <span class="welcome-icon">💖</span>
              <strong>${greeting.title}</strong>
            </div>
            <p class="welcome-desc">${greeting.desc}</p>
            <div class="welcome-starters-title">⚡ Quick Starters</div>
            <div class="welcome-starters-grid">
              <button class="starter-card" onclick="window.chatSendQuick('CRM Overview')">
                <span class="starter-icon">📊</span>
                <span class="starter-text">Overview</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('Today followups')">
                <span class="starter-icon">📅</span>
                <span class="starter-text">Today Follow-ups</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('Pending fees')">
                <span class="starter-icon">💰</span>
                <span class="starter-text">Pending Fees</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('Interested leads')">
                <span class="starter-icon">⭐</span>
                <span class="starter-text">Interested Leads</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('New enquiries')">
                <span class="starter-icon">🆕</span>
                <span class="starter-text">New Enquiries</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('Draft message')">
                <span class="starter-icon">✍️</span>
                <span class="starter-text">Draft Message</span>
              </button>
              ${admin ? `
              <button class="starter-card" onclick="window.chatSendQuick('Staff attendance')">
                <span class="starter-icon">📋</span>
                <span class="starter-text">Staff Attendance</span>
              </button>
              ` : ''}
              <button class="starter-card" onclick="window.chatSendQuick('Nayi enquiry add karo')">
                <span class="starter-icon">➕</span>
                <span class="starter-text">New Enquiry</span>
              </button>
              <button class="starter-card" onclick="window.chatSendQuick('Direct admission karna hai')">
                <span class="starter-icon">🎓</span>
                <span class="starter-text">Direct Admission</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <input
            type="text"
            id="chat-input"
            placeholder="Ask anything... e.g. show today's follow-ups"
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

  // ─── Quick Send (also opens panel if closed) ───────────────────────
  window.chatSendQuick = function (text) {
    // Open panel if closed
    const panel = document.getElementById('chat-panel');
    const fab = document.getElementById('chat-fab');
    if (panel && !panel.classList.contains('open')) {
      panel.classList.add('open');
      if (fab) fab.classList.add('open');
    }
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = text;
      sendMessage();
    }
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
  let wasVoiceQuery = false;

  function showVoiceListeningBanner() {
    removeVoiceListeningBanner();
    const messages = document.getElementById('chat-messages');
    if (!messages) return;
    const banner = document.createElement('div');
    banner.id = 'jiya-listening-banner';
    banner.className = 'chat-msg bot';
    const listeningText = selectedLang === 'hindi' ? 'Jiya AI sun rahi hai...' : 'Jiya AI is listening...';
    banner.innerHTML = `<div class="msg-bubble listening-bubble"><span>🎙️</span> <strong>${listeningText}</strong> <span class="wave-dots"><span></span><span></span><span></span></span></div>`;
    messages.appendChild(banner);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeVoiceListeningBanner() {
    const banner = document.getElementById('jiya-listening-banner');
    if (banner) banner.remove();
  }

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
      wasVoiceQuery = true;
      voiceBtn.classList.add('listening');
      input.placeholder = selectedLang === 'hindi'
        ? '🎙️ Jiya AI sun rahi hai...'
        : '🎙️ Jiya AI is listening...';
      showVoiceListeningBanner();
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
      removeVoiceListeningBanner();
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
    if (chatState.mode === 'awaiting_status_remark') {
      return handleStatusRemark(query);
    }
    if (chatState.mode === 'awaiting_adm_student') {
      return handleAdmStudent(query);
    }
    if (chatState.mode === 'awaiting_adm_course') {
      return handleAdmCourse(query);
    }
    if (chatState.mode === 'awaiting_adm_fees') {
      return handleAdmFees(query);
    }
    if (chatState.mode === 'awaiting_adm_payment') {
      return handleAdmPayment(query);
    }
    if (chatState.mode === 'awaiting_enq_student') {
      return handleEnqStudent(query);
    }
    if (chatState.mode === 'awaiting_enq_course') {
      return handleEnqCourse(query);
    }

    // ── Detect direct admission intent ──
    const lower = query.toLowerCase();
    if (/\b(direct admission|admission karna|admission kar do|admission le lo|student admission)\b/.test(lower)) {
      return startDirectAdmissionFlow();
    }

    // ── Detect new enquiry intent ──
    if (/\b(new enquiry|nayi enquiry|enquiry add|enquiry add kar do|enquiry banao|add enquiry)\b/.test(lower)) {
      return startNewEnquiryFlow();
    }

    // ── Detect local note save intent (only if explicitly asked to save a note) ──
    const isSaveNoteIntent = /\b(save note|note save|save memo|note likho|isko save|isey save)\b/.test(lower) &&
      !/\b(draft|write|create|compose|fee reminder|attendance|payment|follow up|overview|summary)\b/.test(lower);

    if (isSaveNoteIntent) {
      return startSaveNoteFlow();
    }

    // ── Normal API call (Direct to Backend AI) ──
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
        const { message, language, action, rawData, suggestions } = response.data.data;
        const lang = language || selectedLang;
        const intent = response.data.data.intent;

        // If action is status_update_prompt, enter guided confirmation & note state
        if (action && action.type === 'status_update_prompt') {
          chatState.mode = 'awaiting_status_remark';
          chatState.data = {
            enquiryId: action.enquiryId,
            name: action.name,
            newStatus: action.newStatus
          };
          addMessage('bot',
            `❓ **Status Update Confirmation:**\n\n` +
            `Kya aap **${action.name}** ka status **${action.newStatus}** update karna chahte hain?\n\n` +
            `📝 *Koi note/remark likhna hai to niche type karein, ya button dabayein 👇*`,
            false, selectedLang, null,
            [
              { label: '✅ Haan, Update Karo', action: 'confirmStatusUpdate("")' },
              { label: '❌ Cancel', action: 'cancelStatusUpdate()' }
            ]
          );
          return;
        }

        // Render pure chat message
        addMessage('bot', message, true, lang);

        // Auto-speak response if query was spoken via Mic (Walkie-Talkie mode)
        if (wasVoiceQuery) {
          speakText(message, lang);
          wasVoiceQuery = false;
        }

        // Only show contact suggestions if user explicitly requested a call/WhatsApp lookup without exact match
        if (suggestions && suggestions.length > 0 && (intent === 'call' || intent === 'whatsapp')) {
          addContactSuggestionCards(suggestions, intent);
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
      const card = buildContactCard(item.name, item.mobile, item.course, item.status, item.extra);
      card.className = 'chat-msg bot';
      messages.appendChild(card);
    });
    messages.scrollTop = messages.scrollHeight;
  }


  // ─── Build a contact card DOM element (shared by both card renderers) ────
  function buildContactCard(name, mobile, course, status, extra) {
    const cleanMobile = (mobile || '').toString().replace(/\D/g, '');
    const waMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const nameEsc = escapeHtml(name || '');
    const courseEsc = course ? escapeHtml(course) : '';
    const statusEsc = status ? escapeHtml(status) : '';
    const cleanExtra = (extra || '').replace(/Time:\s*[^\u2022|]+/gi, '').replace(/Follow-up:\s*[^\u2022|]+/gi, '').trim();

    const card = document.createElement('div');
    card.innerHTML = `
      <div class="msg-bubble lead-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:7px 9px;margin-top:3px;box-shadow:0 1px 3px rgba(0,0,0,0.06);color:#0f172a;max-width:260px;font-family:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;gap:4px;">
          <div style="font-weight:700;font-size:12px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
            ${nameEsc}${courseEsc ? ` <span style="color:#94a3b8;font-weight:400;font-size:10.5px;">• ${courseEsc}</span>` : ''}
          </div>
          ${statusEsc ? `<span style="background:#e0f2fe;color:#0369a1;font-size:9px;font-weight:700;padding:1px 5px;border-radius:6px;flex-shrink:0;">${statusEsc}</span>` : ''}
        </div>
        <div style="font-size:10.5px;color:#64748b;margin-bottom:5px;">
          📱 ${cleanMobile}${cleanExtra ? ` • <span style="color:#ea580c;font-weight:600;">${cleanExtra}</span>` : ''}
        </div>
        <div style="display:flex;gap:5px;">
          <a href="tel:${cleanMobile}" style="flex:1;text-align:center;text-decoration:none;background:#2563eb;color:#fff;padding:3px 6px;border-radius:5px;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:2px;">
            📞 Call
          </a>
          <button class="wa-pick-btn" data-mobile="${waMobile}" data-name="${nameEsc}" style="flex:1;text-align:center;border:none;cursor:pointer;background:#16a34a;color:#fff;padding:3px 6px;border-radius:5px;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:2px;">
            💬 WhatsApp
          </button>
        </div>
      </div>
    `;
    card.querySelector('.wa-pick-btn').addEventListener('click', function() {
      window.openWaNotesPicker(this.dataset.mobile, this.dataset.name);
    });
    return card;
  }

  // ─── Contact Suggestion Cards (Call/WhatsApp) ────────────────────────────
  function addContactSuggestionCards(suggestions, intent) {
    const messages = document.getElementById('chat-messages');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;';

    suggestions.forEach(item => {
      const c = buildContactCard(item.name, item.mobile, item.course, '', '');
      c.className = 'chat-msg bot';
      wrapper.appendChild(c);
    });

    const outer = document.createElement('div');
    outer.className = 'chat-msg bot';
    outer.appendChild(wrapper);
    messages.appendChild(outer);
    messages.scrollTop = messages.scrollHeight;
  }

  // ─── Copy to Clipboard ──────────────────────────────────────────────────
  window.chatCopy = function (btn, text) {
    if (!navigator.clipboard) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } else {
      navigator.clipboard.writeText(text);
    }
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1600);
  };

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

    let toolsHtml = '';
    if (role === 'bot') {
      const escapedForAttr = text.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
      const isExplicitWaDraft = action && action.type === 'whatsapp';
      const waSendBtn = isExplicitWaDraft
        ? `<button class="msg-tool-btn wa-tool-btn" onclick="window.chatOpenWhatsAppPicker()" title="WhatsApp Direct Send">📲 WhatsApp Pe Bhejo</button>`
        : '';

      toolsHtml = `
        <div class="msg-tools">
          <button class="msg-tool-btn rating-btn" onclick="window.chatRateMessage(this, 'like', '${escapedForAttr}')" title="Helpful 👍">👍</button>
          <button class="msg-tool-btn rating-btn" onclick="window.chatRateMessage(this, 'dislike', '${escapedForAttr}')" title="Not Helpful 👎">👎</button>
          <button class="msg-tool-btn" onclick="window.chatSpeak('${escapedForAttr}', '${lang}')" title="Listen">🔊 Listen</button>
          <button class="msg-tool-btn" onclick="window.chatCopy(this, '${escapedForAttr}')" title="Copy Report">📋 Copy Report</button>
          ${waSendBtn}
        </div>
      `;
    }

    msg.innerHTML = `<div class="msg-bubble">${bubbleText}${confirmBtnsHtml}${actionBtnHtml}</div><div class="msg-footer">${timeEl}${toolsHtml}</div>`;


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

  window.chatOpenWhatsAppPicker = function () {
    window.openWaNotesPicker('', 'Student');
  };

  window.chatRateMessage = function (btn, type, originalText) {
    if (type === 'like') {
      btn.innerHTML = '👍 Liked!';
      btn.style.color = '#86efac';
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      axios.post(`${getApiBase()}/chat`, {
        query: 'feedback: positive rating for good response',
        language: selectedLang
      }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    } else if (type === 'dislike') {
      btn.innerHTML = '👎 Disliked';
      btn.style.color = '#fca5a5';

      addMessage('bot',
        `🙏 **Help Jiya AI Improve:**\n\n` +
        `Is response mein kya problem thi?\n` +
        `_(Jaise: "Response too long", "Wrong date", ya "Unclear format")_\n\n` +
        `Niche type karein ya button dabayein 👇`,
        false, selectedLang, null,
        [
          { label: '📏 Response Short Rakho', action: 'submitDislikeReason("Response short & concise rakha karo")' },
          { label: '❌ Data Check Karo', action: 'submitDislikeReason("Double check data and dates")' },
          { label: '❓ Format Clean Karo', action: 'submitDislikeReason("Use simple clean bullet points")' }
        ]
      );
    }
  };

  window.submitDislikeReason = function (reason) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    axios.post(`${getApiBase()}/chat`, {
      query: `feedback: ${reason}`,
      language: selectedLang
    }, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      if (res.data?.success) {
        addMessage('bot', `✨ **Thank you!** Jiya AI ne aapka feedback save kar liya hai: _"${reason}"_. Future responses iske hisab se improve honge!`);
      }
    })
    .catch(() => {});
  };

  function handleStatusRemark(remark) {
    const lower = remark.toLowerCase();
    if (lower === 'skip' || lower === 'no' || lower === 'nahi') {
      window.confirmStatusUpdate('');
    } else if (lower === 'cancel') {
      window.cancelStatusUpdate();
    } else {
      window.confirmStatusUpdate(remark);
    }
  }

  window.confirmStatusUpdate = async function (remark) {
    const { enquiryId, name, newStatus } = chatState.data || {};
    resetState();
    if (!enquiryId) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
      await axios.put(`${getApiBase()}/enquiries/${enquiryId}`, {
        status: newStatus,
        remarks: remark || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addMessage('bot', `✅ **Done!** **${name}** ka status **${newStatus}** update ho gaya hai.` + (remark ? `\n\n📝 Note: _"${remark}"_` : ''));
    } catch (e) {
      addMessage('bot', `⚠️ Status update nahi ho paya. Dobara try karo.`);
    }
  };

  window.cancelStatusUpdate = function () {
    resetState();
    addMessage('bot', `❌ Status update cancel kar diya gaya.`);
  };

  // ─── Step-wise Guided Direct Admission Flow (100% In-Chat) ────────────────
  function startDirectAdmissionFlow() {
    chatState.mode = 'awaiting_adm_student';
    chatState.data = {};
    addMessage('bot',
      `🎓 **Direct Admission Flow (Step 1/4):**\n\n` +
      `Kripya Student ka **Naam** aur **Mobile Number** chat mein type karein:\n` +
      `_(Jaise: "Aarav Sharma 9876543210")_`,
      false, selectedLang, null,
      [
        { label: '❌ Cancel', action: 'cancelAdmissionFlow()' }
      ]
    );
  }

  function handleAdmStudent(query) {
    const mobileMatch = query.match(/\b[6-9]\d{9}\b/);
    const mobile = mobileMatch ? mobileMatch[0] : '';
    const name = query.replace(/\b[6-9]\d{9}\b/g, '').trim() || 'Student';

    chatState.data.name = name;
    chatState.data.mobile = mobile;
    chatState.mode = 'awaiting_adm_course';

    addMessage('bot',
      `👍 Student: **${name}** ${mobile ? `(📱 ${mobile})` : ''}\n\n` +
      `📚 **Step 2/4 (Course Selection):**\n` +
      `Kaunse course mein admission karna hai?\n` +
      `_(Jaise: "BCA", "DCA", "Tally Prime", "Python")_`
    );
  }

  function handleAdmCourse(course) {
    chatState.data.course = course;
    chatState.mode = 'awaiting_adm_fees';

    addMessage('bot',
      `👍 Course: **${course}**\n\n` +
      `💰 **Step 3/4 (Total Fees):**\n` +
      `Is course ki total fees kitni hai?\n` +
      `_(Jaise: "15000")_`
    );
  }

  function handleAdmFees(feesStr) {
    const fees = parseInt(feesStr.replace(/\D/g, '')) || 0;
    chatState.data.totalFees = fees;
    chatState.mode = 'awaiting_adm_payment';

    addMessage('bot',
      `👍 Total Fees: **₹${fees.toLocaleString('en-IN')}**\n\n` +
      `💵 **Step 4/4 (Initial Down Payment & Payment Mode):**\n` +
      `Initial down payment amount aur payment mode type karein:\n` +
      `_(Jaise: "5000 UPI" ya "3000 Cash")_`
    );
  }

  function handleAdmPayment(payStr) {
    const amount = parseInt(payStr.replace(/\D/g, '')) || 0;
    let mode = 'Cash';
    if (/upi/i.test(payStr)) mode = 'UPI';
    else if (/card/i.test(payStr)) mode = 'Card';
    else if (/net|bank/i.test(payStr)) mode = 'NetBanking';

    chatState.data.initialPayment = amount;
    chatState.data.initialPaymentMode = mode;
    chatState.mode = 'awaiting_adm_confirm';

    const { name, mobile, course, totalFees } = chatState.data;
    const remaining = totalFees - amount;

    addMessage('bot',
      `📋 **Direct Admission Preview:**\n\n` +
      `👤 **Student:** ${name} ${mobile ? `(📱 ${mobile})` : ''}\n` +
      `📚 **Course:** ${course}\n` +
      `💰 **Total Fees:** ₹${totalFees.toLocaleString('en-IN')}\n` +
      `💵 **Down Payment:** ₹${amount.toLocaleString('en-IN')} (${mode})\n` +
      `🧾 **Remaining Dues:** ₹${remaining.toLocaleString('en-IN')}\n\n` +
      `Is admission ko direct CRM mein save karein?`,
      false, selectedLang, null,
      [
        { label: '✅ Confirm Admission & Save', action: 'confirmAdmissionSave()' },
        { label: '❌ Cancel', action: 'cancelAdmissionFlow()' }
      ]
    );
  }

  window.confirmAdmissionSave = async function () {
    const data = chatState.data;
    resetState();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
      const response = await axios.post(`${getApiBase()}/admissions`, {
        name: data.name,
        mobile: data.mobile || '9999999999',
        course: data.course,
        totalFees: data.totalFees,
        initialPayment: data.initialPayment,
        initialPaymentMode: data.initialPaymentMode,
        admissionDate: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const admission = response.data.data.admission || response.data.data;
        const receiptMsg = `Namaste ${data.name}! Aapka ${data.course} course mein admission ho gaya hai. Total Fees: ₹${data.totalFees}, Paid: ₹${data.initialPayment}. Thank you!`;

        addMessage('bot',
          `🎉 **Admission Successfully Saved!**\n\n` +
          `🎓 **${data.name}** ka **${data.course}** mein admission complete ho gaya hai.\n` +
          `🧾 Receipt & Installment record created in CRM.`
        );

        if (data.mobile && data.mobile.length === 10) {
          addMessage('bot',
            `📲 Student ko WhatsApp invoice receipt bhejne ke liye click karein 👇`,
            false, selectedLang, {
              type: 'whatsapp',
              mobile: data.mobile,
              name: data.name,
              text: receiptMsg
            }
          );
        }
      } else {
        addMessage('bot', `⚠️ Admission save nahi ho saka: ${response.data.message || 'Error'}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Server error';
      addMessage('bot', `❌ Admission error: ${msg}`);
    }
  };

  window.cancelAdmissionFlow = function () {
    resetState();
    addMessage('bot', `❌ Admission process cancel kar diya gaya.`);
  };

  // ─── Step-wise Guided New Enquiry Flow (100% In-Chat) ─────────────────────
  function startNewEnquiryFlow() {
    chatState.mode = 'awaiting_enq_student';
    chatState.data = {};
    addMessage('bot',
      `📝 **New Enquiry Flow (Step 1/2):**\n\n` +
      `Kripya Student ka **Naam** aur **10-digit Mobile Number** chat mein type karein:\n` +
      `_(Jaise: "Pooja Verma 9876543210")_`,
      false, selectedLang, null,
      [
        { label: '❌ Cancel', action: 'cancelEnquiryFlow()' }
      ]
    );
  }

  function handleEnqStudent(query) {
    const mobileMatch = query.match(/\b[6-9]\d{9}\b/);
    if (!mobileMatch) {
      addMessage('bot',
        `⚠️ **Mobile Number Missing / Invalid!**\n\n` +
        `Kripya valid **10-digit Mobile Number** bhi enter karein:\n` +
        `_(Jaise: "Pooja Verma 9876543210")_`
      );
      return;
    }

    const mobile = mobileMatch[0];
    const name = query.replace(/\b[6-9]\d{9}\b/g, '').trim() || 'Enquiry Student';

    chatState.data.name = name;
    chatState.data.mobile = mobile;
    chatState.mode = 'awaiting_enq_course';

    addMessage('bot',
      `👍 Student: **${name}** (📱 ${mobile})\n\n` +
      `📚 **Step 2/2 (Course Selection):**\n` +
      `Kaunse course ke liye enquiry hai?\n` +
      `_(Jaise: "BCA", "DCA", "Tally", "Python")_`
    );
  }

  function handleEnqCourse(course) {
    chatState.data.course = course;
    chatState.mode = 'awaiting_enq_confirm';

    const { name, mobile } = chatState.data;

    addMessage('bot',
      `📋 **New Enquiry Preview:**\n\n` +
      `👤 **Student:** ${name}\n` +
      `📱 **Mobile:** ${mobile}\n` +
      `📚 **Course:** ${course}\n\n` +
      `Is enquiry ko CRM database mein save karein?`,
      false, selectedLang, null,
      [
        { label: '✅ Confirm & Save Enquiry', action: 'confirmEnquirySave()' },
        { label: '❌ Cancel', action: 'cancelEnquiryFlow()' }
      ]
    );
  }

  window.confirmEnquirySave = async function () {
    const data = chatState.data;
    resetState();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    try {
      const response = await axios.post(`${getApiBase()}/enquiries`, {
        name: data.name,
        mobile: data.mobile,
        course: data.course,
        source: 'walk_in'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        addMessage('bot',
          `🎉 **Enquiry Successfully Created!**\n\n` +
          `📝 **${data.name}** (📱 ${data.mobile}) ka enquiry record **${data.course}** course ke liye save ho gaya hai.`
        );
      } else {
        addMessage('bot', `⚠️ Enquiry save nahi ho saka: ${response.data.message || 'Error'}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Server error';
      addMessage('bot',
        `❌ **Enquiry Error:** ${msg}\n\n` +
        `Dobara try karne ke liye type karein *"New Enquiry"*`
      );
    }
  };

  window.cancelEnquiryFlow = function () {
    resetState();
    addMessage('bot', `❌ Enquiry creation process cancel kar diya gaya.`);
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

  // ─── WhatsApp Notes Picker Popup ──────────────────────────────────
  window.openWaNotesPicker = async function (waMobile, contactName) {
    // Remove any existing popup
    const old = document.getElementById('wa-notes-popup');
    if (old) old.remove();

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    // Build popup
    const overlay = document.createElement('div');
    overlay.id = 'wa-notes-popup';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;padding:0 0 60px;';

    overlay.innerHTML = `
      <div id="wa-notes-sheet" style="background:#1e293b;border-radius:16px 16px 0 0;width:100%;max-width:420px;padding:0;box-shadow:0 -8px 32px rgba(0,0,0,0.4);overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:12px 14px 10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:700;font-size:13px;color:#fff;">\u{1F4AC} WhatsApp to <span style='color:#bbf7d0;'>${contactName}</span></div>
              <div style="font-size:10.5px;color:#86efac;margin-top:1px;">Pick a saved note or send without message</div>
            </div>
            <button onclick="document.getElementById('wa-notes-popup').remove()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;border-radius:50%;width:26px;height:26px;font-size:14px;cursor:pointer;line-height:1;">&times;</button>
          </div>
          <input id="wa-note-search" autofocus placeholder="🔍 Search saved notes/templates..." style="margin-top:8px;width:100%;box-sizing:border-box;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:7px 10px;color:#fff;font-size:12px;outline:none;" />
        </div>
        <!-- Notes List -->
        <div id="wa-notes-list" style="max-height:240px;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px;">
          <div style="color:#94a3b8;font-size:12px;text-align:center;padding:20px 0;">Loading notes...</div>
        </div>
        <!-- Footer: send without note -->
        <div style="padding:8px 10px 12px;border-top:1px solid rgba(255,255,255,0.08);">
          <button onclick="window.open('https://wa.me/${waMobile}','_blank');document.getElementById('wa-notes-popup').remove();" style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:8px;padding:8px;font-size:11.5px;font-weight:600;cursor:pointer;">\u{1F4F1} Open WhatsApp without message</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Fetch notes
    let allNotes = [];
    try {
      const res = await axios.get(`${getApiBase()}/notes`, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 });
      allNotes = (res.data.data && res.data.data.notes) ? res.data.data.notes : (Array.isArray(res.data.data) ? res.data.data : []);
    } catch (e) {
      // fallback: try chat query for notes
      try {
        const res2 = await axios.post(`${getApiBase()}/chat`, { query: 'show my saved notes' }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
        if (res2.data.data && res2.data.data.action && res2.data.data.action.notes) {
          allNotes = res2.data.data.action.notes;
        }
      } catch (_) {}
    }

    function renderNotes(filter) {
      const list = document.getElementById('wa-notes-list');
      if (!list) return;
      const filtered = allNotes.filter(n =>
        !filter || (n.title || '').toLowerCase().includes(filter) || (n.content || '').toLowerCase().includes(filter)
      );
      if (!filtered.length) {
        list.innerHTML = `<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px 0;">
          ${allNotes.length === 0
            ? '\u{1F4DD} No saved notes yet.<br><span style="font-size:11px;">Type <em>&quot;save note: your message&quot;</em> in chat to save one.</span>'
            : 'No notes match your search.'}
        </div>`;
        return;
      }
      list.innerHTML = '';
      filtered.forEach(note => {
        const row = document.createElement('button');
        row.style.cssText = 'width:100%;text-align:left;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;cursor:pointer;color:#e2e8f0;display:block;';
        row.innerHTML = `
          <div style="font-weight:700;font-size:12px;color:#fff;margin-bottom:2px;">\u{1F4CC} ${escapeHtml(note.title || 'Untitled')}</div>
          <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml((note.content || '').substring(0, 80))}${(note.content || '').length > 80 ? '...' : ''}</div>
        `;
        row.addEventListener('click', () => {
          const text = encodeURIComponent(note.content || '');
          window.open(`https://wa.me/${waMobile}?text=${text}`, '_blank');
          overlay.remove();
        });
        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(22,163,74,0.2)'; row.style.borderColor = 'rgba(22,163,74,0.4)'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.05)'; row.style.borderColor = 'rgba(255,255,255,0.1)'; });
        list.appendChild(row);
      });
    }

    renderNotes('');
    const searchInput = document.getElementById('wa-note-search');
    if (searchInput) searchInput.addEventListener('input', (e) => renderNotes(e.target.value.toLowerCase().trim()));
  };

  // ─── Toggle "More" Chips ────────────────────────────────────────────────
  window.chatToggleMoreChips = function () {
    const panel = document.getElementById('chat-more-chips');
    const btn = document.getElementById('chat-more-btn');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (btn) btn.textContent = isOpen ? '⋯ More' : '✕ Less';
  };

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
