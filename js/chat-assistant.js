/**
 * SSSAM CRM — AI Chat Assistant
 * Voice + Text search using Gemini AI
 * Supports Hindi & English
 */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────
  const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';
  let selectedLang = 'hindi'; // default language
  let isListening = false;
  let recognition = null;
  let isSpeaking = false;
  let currentUtterance = null;

  // ─── Inject HTML ─────────────────────────────────────────────────────────
  function injectChatWidget() {
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
            <p>Data search • Follow-ups • Fees</p>
          </div>
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
          <button class="quick-chip" onclick="window.chatSendQuick('help')">📖 Guide / Help</button>
          <button class="quick-chip" onclick="window.chatSendQuick('aaj ke follow up')">📅 Follow-ups</button>
          <button class="quick-chip" onclick="window.chatSendQuick('pending fees')">💰 Pending Fees</button>
          <button class="quick-chip" onclick="window.chatSendQuick('saved notes dikhao')">📝 Saved Notes</button>
        </div>

        <!-- Messages -->
        <div id="chat-messages">
          <div class="chat-welcome">
            <span class="welcome-icon">🎙️</span>
            <strong>Namaste! SSSAM AI Assistant mein aapka swagat hai</strong>
            Aap bolkar ya likhkar kisi ka bhi data check kar sakte hain, call/whatsapp commands use kar sakte hain, aur notes save kar sakte hain.<br>
            <span style="color:#818cf8;font-weight:600;display:block;margin-top:6px;">📖 "Guide / Help" chip par click karke details dekhain!</span>
          </div>
        </div>

        <!-- Input Area -->
        <div class="chat-input-area">
          <input
            type="text"
            id="chat-input"
            placeholder="Type karo ya mic click karo..."
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

    // Voice button
    voiceBtn.addEventListener('click', toggleVoice);

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !fab.contains(e.target)) {
        panel.classList.remove('open');
        fab.classList.remove('open');
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
      input.placeholder = selectedLang === 'hindi' ? 'Hindi ya English mein puchho...' : 'Type your question...';

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

  // ─── Send Message ────────────────────────────────────────────────────────
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();

    if (!query) return;

    // Show user message
    addMessage('user', query);
    input.value = '';

    // Show typing indicator
    const typingId = showTyping();

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      if (!token) {
        removeTyping(typingId);
        addMessage('bot', '❌ Login session expire ho gayi. Please page reload karo aur dobara login karo.');
        return;
      }

      const response = await axios.post(`${API_BASE}/chat`, { query }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });

      removeTyping(typingId);

      if (response.data.success) {
        const message = response.data.data.message;
        const lang = response.data.data.language || selectedLang;
        const action = response.data.data.action;
        addMessage('bot', message, true, lang, action);
      } else {
        addMessage('bot', '⚠️ Kuch gadbad hui. Dobara try karo.');
      }

    } catch (error) {
      removeTyping(typingId);
      let errorMsg = '⚠️ Server se connect nahi ho pa raha.';

      if (error.response) {
        if (error.response.status === 401) {
          errorMsg = '❌ Login session expire. Reload karke login karo.';
        } else if (error.response.status === 400) {
          errorMsg = `❌ ${error.response.data?.message || 'Invalid query.'}`;
        } else if (error.response.status === 500) {
          errorMsg = '⚠️ Server error. Thodi der baad try karo.';
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = '⏱️ Response aane mein zyada time lag raha hai. Try again.';
      }

      addMessage('bot', errorMsg);
    }
  }

  // ─── Add Message to Chat ─────────────────────────────────────────────────
  function addMessage(role, text, withSpeakBtn = false, lang = selectedLang, action = null) {
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
        actionBtnHtml = `
          <div class="msg-action-container">
            <a href="https://wa.me/${cleanMobile}" target="_blank" class="msg-action-btn whatsapp-btn">
              <span style="font-size: 16px; margin-right: 6px;">💬</span> WhatsApp ${action.name || 'Student'}
            </a>
          </div>
        `;
      }
    }

    msg.innerHTML = `
      <div class="msg-bubble">
        ${bubbleText}
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
