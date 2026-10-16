// 右下角的 ElevenLabs 語音小工具（讓安安可以跟 AI 聊天）
//
// agent-id 不是密鑰：它本來就會出現在任何網頁的原始碼裡，無法隱藏。
// 真正的防護要在 ElevenLabs 後台做（Agent → Security）：
//   1. 開啟 Authentication（require auth）以外，先設定「Allowlist」只允許
//      你的網域（例如 cake11298.github.io）。
//   2. 設定 concurrent calls / daily call limit 與單次通話最長時間。
//   3. 在帳號設定把每月用量上限調低，必要時加上預算警示。
const AGENT_ID = 'agent_7901m2yf7smmfs593saxyw20s2xk';

export function mountVoiceAgent() {
  if (document.querySelector('elevenlabs-convai')) return;
  const el = document.createElement('elevenlabs-convai');
  el.setAttribute('agent-id', AGENT_ID);
  document.body.appendChild(el);
  // 動態載入：不拖慢遊戲首屏。套件由本站一起打包，不再依賴 unpkg。
  import('@elevenlabs/convai-widget-embed').catch((err) => {
    console.warn('語音小工具載入失敗', err);
    el.remove();
  });
}

// 在小工具裡打字／按空白鍵時，不要讓遊戲把它當成移動或吹蠟燭
export function isFromVoiceAgent(e) {
  const t = e.target;
  return !!(t && t.closest && t.closest('elevenlabs-convai'));
}
