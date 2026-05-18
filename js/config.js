// ============================================================
// CONFIGURAÇÃO — preencher após criar as contas externas
// ============================================================

const CONFIG = {

  // --- Firebase ---
  // Criar em: console.firebase.google.com
  // Projeto → Configurações → Suas apps → Adicionar app (Web) → copiar objeto
  firebase: {
    apiKey:            "AIzaSyCfQ3vNu6-ROUADwHpMc9NIUMu6t8HBg8k",
    authDomain:        "lh-conferencia.firebaseapp.com",
    projectId:         "lh-conferencia",
    storageBucket:     "lh-conferencia.firebasestorage.app",
    messagingSenderId: "60986738962",
    appId:             "1:60986738962:web:80dcbf0a1d486edcc84bcb"
  },

  // --- EmailJS ---
  // Criar em: emailjs.com → Account → Email Services + Templates
  emailjs: {
    serviceId:  "service_c50er6x",
    templateId: "template_5uy9wl5",
    publicKey:  "xvos7kUEzGDGfVTlY"
  },

  // E-mail que receberá as planilhas
  emailDestino: "operacional.lhtransportes@lhcp.com.br",

  // Senha de liberação de descarga com falta/sobra (base64 para ofuscação)
  // Para alterar a senha: abra o console do browser e execute:
  //   btoa('NOVA_SENHA')   e substitua o valor abaixo
  _ap: 'TEhBRE1JTjE2MTAu',

  checkAdminPassword(input) {
    try {
      return btoa(unescape(encodeURIComponent(input))) === this._ap;
    } catch {
      return false;
    }
  },

  isFirebaseConfigured() {
    return this.firebase.apiKey && !this.firebase.apiKey.startsWith('YOUR_');
  },

  isEmailConfigured() {
    return this.emailjs.publicKey && !this.emailjs.publicKey.startsWith('YOUR_');
  }
};
