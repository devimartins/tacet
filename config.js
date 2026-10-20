// Preencha depois de criar o Supabase e o Worker (veja o README). Sem isso o app abre em modo demonstração.
window.CFG = {
  AI: "https://tacet-ai.davimdmelo.workers.dev",            // URL do Worker, ex.: https://tacet-ai.SEU-USUARIO.workers.dev
  SB_URL: "https://ubxzdibckvbquuevhvap.supabase.co",        // https://SEU-PROJETO.supabase.co
  SB_ANON: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVieHpkaWJja3ZicXV1ZXZodmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MDU2MTYsImV4cCI6MjEwODA4MTYxNn0.lDP4VNXYl2JR5gWGApUe-3KUXAGy-to_EzGb2ZMYFIQ",
  PROVIDERS: ["github"],   // provedores de login ativados no Supabase       // chave "anon" pública do Supabase
  PAY: false,        // true = botão "Assinar o Pro" (Mercado Pago) ativo; exige MP_TOKEN no Worker
  GATE: false,       // true = estilos pagos bloqueados para o plano gratuito (ligue quando houver cobrança)
  ADS_CLIENT: "",    // ca-pub-XXXXXXXXXXXXXXXX (AdSense); vazio = sem anúncios
  ADS_SLOT: "",
};
