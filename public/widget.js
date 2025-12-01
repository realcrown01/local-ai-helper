(function () {
  // Find the script tag that loaded this file
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var siteId = currentScript.getAttribute('data-site-id') || 'default';

  // Derive API base from script src: e.g. https://your-app.onrender.com/widget.js -> https://your-app.onrender.com
  var scriptSrc = currentScript.src;
  var API_BASE = scriptSrc.split('/').slice(0, 3).join('/');

  // ---- Styles ----
  var style = document.createElement('style');
  style.textContent = ''
    + '.ai-bubble {'
    + '  position: fixed;'
    + '  bottom: 20px;'
    + '  right: 20px;'
    + '  width: 60px;'
    + '  height: 60px;'
    + '  border-radius: 50%;'
    + '  background: #007bff;'
    + '  color: white;'
    + '  font-size: 30px;'
    + '  display: flex;'
    + '  align-items: center;'
    + '  justify-content: center;'
    + '  cursor: pointer;'
    + '  box-shadow: 0 4px 12px rgba(0,0,0,0.3);'
    + '  z-index: 999999;'
    + '}'
    + '.ai-window {'
    + '  position: fixed;'
    + '  bottom: 100px;'
    + '  right: 20px;'
    + '  width: 330px;'
    + '  height: 450px;'
    + '  background: #ffffff;'
    + '  border-radius: 12px;'
    + '  display: none;'
    + '  flex-direction: column;'
    + '  box-shadow: 0 4px 16px rgba(0,0,0,0.25);'
    + '  z-index: 999998;'
    + '  font-family: Arial, sans-serif;'
    + '}'
    + '.ai-header {'
    + '  background: #007bff;'
    + '  color: white;'
    + '  padding: 10px;'
    + '  font-size: 15px;'
    + '  font-weight: bold;'
    + '  display: flex;'
    + '  justify-content: space-between;'
    + '  align-items: center;'
    + '}'
    + '.ai-close {'
    + '  cursor: pointer;'
    + '  font-size: 20px;'
    + '}'
    + '.ai-chat {'
    + '  flex: 1;'
    + '  padding: 10px;'
    + '  overflow-y: auto;'
    + '  background: #f7f7f7;'
    + '}'
    + '.ai-msg {'
    + '  margin: 4px 0;'
    + '  padding: 6px 10px;'
    + '  border-radius: 6px;'
    + '  font-size: 13px;'
    + '  white-space: pre-wrap;'
    + '}'
    + '.ai-user {'
    + '  background: #e3f4ff;'
    + '  text-align: right;'
    + '}'
    + '.ai-bot {'
    + '  background: #ffffff;'
    + '  text-align: left;'
    + '}'
    + '.ai-input-row {'
    + '  display: flex;'
    + '  padding: 8px;'
    + '  border-top: 1px solid #ddd;'
    + '  background: #fafafa;'
    + '}'
    + '.ai-input {'
    + '  flex: 1;'
    + '  padding: 6px;'
    + '  font-size: 13px;'
    + '  border: 1px solid #ccc;'
    + '  border-radius: 4px;'
    + '}'
    + '.ai-send {'
    + '  padding: 6px 12px;'
    + '  margin-left: 6px;'
    + '  background: #007bff;'
    + '  color: white;'
    + '  border: none;'
    + '  border-radius: 4px;'
    + '  cursor: pointer;'
    + '}';

  document.head.appendChild(style);

  // ---- Create DOM elements ----
  var bubble = document.createElement('div');
  bubble.className = 'ai-bubble';
  bubble.textContent = '💬';

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

  var closeBtn = header.querySelector('.ai-close');

  // ---- Chat logic ----
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

  // ---- Event handlers ----
  bubble.addEventListener('click', function () {
    if (windowEl.style.display === 'flex') {
      windowEl.style.display = 'none';
    } else {
      windowEl.style.display = 'flex';

      // First open: send greeting
      if (history.length === 0) {
        var greet = "Hi! I'm the assistant for this business. Tell me what you need help with and I'll collect your details and help schedule a visit.";
        addMessage(greet, 'bot');
        history.push({ role: 'assistant', content: greet });
      }
    }
  });

  closeBtn.addEventListener('click', function () {
    windowEl.style.display = 'none';
  });

  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
})();
