(function () {
  // Get siteId from script tag
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var siteId = currentScript.getAttribute('data-site-id') || 'default';

  // API base URL
  var scriptSrc = currentScript.src;
  var API_BASE = scriptSrc.split('/').slice(0, 3).join('/');

  // ---- Styles ----
  var style = document.createElement('style');
  style.textContent = `
    .ai-bubble {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #007bff;
      color: white;
      font-size: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
      border: 2px solid #ffffff;
      z-index: 999999;
      box-sizing: border-box;
    }

    .ai-bubble::after {
      content: "";
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      background: rgba(0,123,255,0.35);
      animation: ai-pulse 1.6s infinite;
      z-index: -1;
    }

    @keyframes ai-pulse {
      0% { transform: scale(0.85); opacity: 0.9; }
      70% { transform: scale(1.25); opacity: 0; }
      100% { transform: scale(0.85); opacity: 0; }
    }

    .ai-notify {
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeInUp 0.4s ease-out;
      z-index: 999999;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0px); }
    }

    .ai-notify-close {
      cursor: pointer;
      font-weight: bold;
      font-size: 16px;
      margin-left: 6px;
    }

    .ai-window {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 330px;
      height: 450px;
      background: #ffffff;
      border-radius: 12px;
      display: none;
      flex-direction: column;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      z-index: 999998;
      font-family: Arial, sans-serif;
    }

    .ai-header {
      background: #007bff;
      color: white;
      padding: 10px;
      font-size: 15px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ai-close {
      cursor: pointer;
      font-size: 20px;
    }

    .ai-chat {
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      background: #f7f7f7;
    }

    .ai-msg {
      margin: 4px 0;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 13px;
      white-space: pre-wrap;
    }

    .ai-user {
      background: #e3f4ff;
      text-align: right;
    }

    .ai-bot {
      background: #ffffff;
      text-align: left;
    }

    .ai-input-row {
      display: flex;
      padding: 8px;
      border-top: 1px solid #ddd;
      background: #fafafa;
    }

    .ai-input {
      flex: 1;
      padding: 6px;
      font-size: 13px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .ai-send {
      padding: 6px 12px;
      margin-left: 6px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .ai-send:hover {
      background: #0062cc;
    }
  `;
  document.head.appendChild(style);

  // ---- Create DOM elements ----
  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  bubble.textContent = '💬';

  var notify = document.createElement('div');
  notify.className = 'ai-notify';
  notify.innerHTML = `
    Need help?
    <span class="ai-notify-close">&times;</span>
  `;

  var windowEl = document.createElement('div');
  windowEl.className = 'ai-window';

  var header = document.createElement('div');
  header.className = 'ai-header';
  header.innerHTML = 'AI Assistant <span class="ai-close">&times;</span>';

  var chat = document.createElement('div');
  chat.className = 'ai-chat';

  var inputRow = document.createElement('div');
  inputRow.className = 'ai-input-row';

  var input = document.createElement('input');
  input.className = 'ai-input';
  input.placeholder = 'Type your message...';

  var sendBtn = document.createElement('button');
  sendBtn.className = 'ai-send';
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  windowEl.appendChild(header);
  windowEl.appendChild(chat);
  windowEl.appendChild(inputRow);

  document.body.appendChild(bubble);
  document.body.appendChild(windowEl);

  // ---- Popup logic (once per visitor, delayed) ----
  if (!localStorage.getItem("ai_popup_dismissed")) {
    // show after 2 seconds
    setTimeout(function () {
      // Check again in case they already opened chat quickly
      if (localStorage.getItem("ai_popup_dismissed")) return;

      document.body.appendChild(notify);

      var notifyClose = notify.querySelector('.ai-notify-close');
      notifyClose.addEventListener('click', function () {
        if (notify.parentNode) notify.remove();
        localStorage.setItem("ai_popup_dismissed", "true");
      });

      // Auto-hide after 7 seconds
      setTimeout(function () {
        if (notify.parentNode) {
          notify.remove();
          localStorage.setItem("ai_popup_dismissed", "true");
        }
      }, 7000);
    }, 2000);
  }

  // ---- Chat logic ----
  var closeBtn = header.querySelector('.ai-close');
  var history = [];

  function addMessage(text, sender) {
    var msg = document.createElement('div');
    msg.className = 'ai-msg ' + (sender === 'user' ? 'ai-user' : 'ai-bot');
    msg.textContent = text;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    history.push({ role: 'user', content: text });
    input.value = '';

    fetch(API_BASE + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: history,
        siteId: siteId
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data && data.reply) {
        addMessage(data.reply, 'bot');
        history.push({ role: 'assistant', content: data.reply });
      } else {
        addMessage('Error: No reply from server.', 'bot');
      }
    })
    .catch(function (err) {
      console.error(err);
      addMessage('Error contacting server.', 'bot');
    });
  }

  // ---- Events ----
  bubble.addEventListener('click', function () {
    localStorage.setItem("ai_popup_dismissed", "true");

    if (notify && notify.parentNode) {
      notify.remove();
    }

    windowEl.style.display = 'flex';

    if (history.length === 0) {
      var greet = "Hi! I'm the assistant for this business. Tell me what you need help with.";
      addMessage(greet, 'bot');
      history.push({ role: 'assistant', content: greet });
    }
  });

  closeBtn.addEventListener('click', function () {
    windowEl.style.display = 'none';
  });

  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });
})();
