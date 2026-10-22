/**
 * BuzzerGuard AI - Frontend Logic
 * Sistem Deteksi Otomatis Akun Buzzer Sintetis di Media Sosial
 * Berdasarkan Jurnal Penelitian Ni Komang Laksmi Kartika Santhi (ITB STIKOM Bali)
 */

let APP_STATE = {
  sampleCases: [],
  injectionTemplates: [],
  lastAnalysisResult: null,
  defenseStage: 1,
};

document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
});

async function initializeApp() {
  try {
    const resp = await fetch("/api/init");
    const data = await resp.json();
    if (data.status === "ok") {
      APP_STATE.sampleCases = data.sample_cases || [];
      APP_STATE.injectionTemplates = data.injection_templates || [];

      if (data.journal_info && data.journal_info.system_prompt) {
        document.getElementById("system-prompt-preview").value = data.journal_info.system_prompt;
      }

      renderPresetChips();
      renderJournalTable2();
      renderInjectionTemplates();

      // Jalankan analisis otomatis untuk kasus pertama (Ibu-Ibu Laundry) saat halaman dibuka
      await runStylisticAnalysis();
    }
  } catch (err) {
    console.error("Gagal memuat inisialisasi dari server:", err);
  }
}

function switchTab(tabId, btnEl) {
  document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
  if (btnEl) btnEl.classList.add("active");
}

function toggleAcademicMode() {
  document.body.classList.toggle("academic-mode");
  const isAcademic = document.body.classList.contains("academic-mode");
  const btn = document.getElementById("theme-toggle-btn");
  if (isAcademic) {
    btn.innerHTML = "🌙 Mode Cyber-Forensik (Gelap)";
  } else {
    btn.innerHTML = "📸 Mode Screenshot Jurnal (Terang)";
  }
}

function renderPresetChips() {
  const container = document.getElementById("preset-chips-container");
  if (!container) return;
  container.innerHTML = "";

  APP_STATE.sampleCases.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = "chip-btn";
    btn.textContent = `${idx + 1}. ${item.username} (${item.expected_label})`;
    btn.onclick = () => loadSampleCase(item.id);
    container.appendChild(btn);
  });
}

function loadSampleCase(caseId) {
  const found = APP_STATE.sampleCases.find((c) => c.id === caseId);
  if (!found) return;

  document.getElementById("input-username").value = found.username;
  document.getElementById("input-persona").value = found.persona_claim;
  document.getElementById("input-comment").value = found.comment_text;

  // Pindah ke tab detektor bila dipanggil dari Tabel 2
  const firstNavBtn = document.querySelector(".nav-btn");
  switchTab("tab-detector", firstNavBtn);

  runStylisticAnalysis();
}

async function runStylisticAnalysis() {
  const username = document.getElementById("input-username").value.trim() || "@user_sosmed";
  const persona_claim = document.getElementById("input-persona").value.trim() || "Masyarakat Umum";
  const comment_text = document.getElementById("input-comment").value.trim();
  const providerSelect = document.getElementById("llm-provider").value;
  const apiKey = document.getElementById("llm-api-key").value.trim();

  if (!comment_text) {
    alert("Silakan masukkan teks komentar terlebih dahulu.");
    return;
  }

  const btn = document.getElementById("btn-run-analysis");
  const originalText = btn.innerHTML;
  btn.innerHTML = "⏳ Menganalisis Gaya Bahasa & EYD...";

  try {
    const resp = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        persona_claim,
        comment_text,
        provider: providerSelect === "local" ? "gemini" : providerSelect,
        api_key: providerSelect === "local" ? "" : apiKey,
      }),
    });
    const data = await resp.json();
    if (data.status === "ok" && data.result) {
      APP_STATE.lastAnalysisResult = data.result;
      renderAnalysisResult(data.result);
    }
  } catch (err) {
    console.error("Error saat analisis:", err);
  } finally {
    btn.innerHTML = originalText;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightCommentAnomalies(text, highlights) {
  let html = escapeHtml(text);
  if (!highlights) return `"${html}"`;

  // Highlight System Prompt Leak phrases (Red)
  (highlights.leak_phrases || []).forEach((phrase) => {
    if (!phrase) return;
    const reg = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    html = html.replace(reg, `<span class="hl-leak" title="System Prompt Leak / Identitas AI">$1</span>`);
  });

  // Highlight Roleplay & Hyperbole phrases (Orange)
  const orangePhrases = [...(highlights.roleplay_phrases || []), ...(highlights.hyperbole_phrases || [])];
  orangePhrases.forEach((phrase) => {
    if (!phrase) return;
    const reg = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    html = html.replace(reg, `<span class="hl-hyperbole" title="Pola Roleplay / Hiperbola LLM">$1</span>`);
  });

  // Highlight Organic Slang words (Green)
  (highlights.slang_words || []).forEach((word) => {
    if (!word) return;
    const reg = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "gi");
    html = html.replace(reg, `<span class="hl-slang" title="Bahasa Gaul Organik (Slang Lokal)">$1</span>`);
  });

  return `"${html}"`;
}

function renderAnalysisResult(res) {
  document.getElementById("result-account-tag").textContent = `${res.username} • ${res.persona_claim}`;

  const banner = document.getElementById("verdict-banner");
  banner.className = `verdict-banner ${res.severity}`;

  document.getElementById("verdict-classification").textContent = res.classification;
  document.getElementById("verdict-recommendation").textContent = res.recommended_action;

  const scoreCircle = document.getElementById("verdict-score-circle");
  scoreCircle.style.color = res.badge_color;
  document.getElementById("verdict-score-num").textContent = `${res.bot_probability}%`;

  // Annotated comment quote
  document.getElementById("annotated-comment-box").innerHTML = highlightCommentAnomalies(
    res.comment_text,
    res.highlights
  );

  // Update 4 progress bars
  const m = res.metrics;
  document.getElementById("val-eyd").textContent = `${m.eyd_perfection}%`;
  document.getElementById("bar-eyd").style.width = `${m.eyd_perfection}%`;

  document.getElementById("val-persona").textContent = `${m.persona_mismatch}%`;
  document.getElementById("bar-persona").style.width = `${m.persona_mismatch}%`;

  document.getElementById("val-story").textContent = `${m.storytelling_hyperbole}%`;
  document.getElementById("bar-story").style.width = `${m.storytelling_hyperbole}%`;

  document.getElementById("val-slang").textContent = `${m.organic_slang_index}%`;
  document.getElementById("bar-slang").style.width = `${m.organic_slang_index}%`;

  // Render findings
  const findingsList = document.getElementById("findings-list");
  findingsList.innerHTML = "";
  (res.findings || []).forEach((f) => {
    const div = document.createElement("div");
    div.className = `finding-box ${f.level}`;
    div.innerHTML = `<strong>[${f.level}] ${escapeHtml(f.type)}</strong><span>${escapeHtml(f.detail)}</span>`;
    findingsList.appendChild(div);
  });

  // External LLM box
  const extBox = document.getElementById("external-llm-box");
  const extText = document.getElementById("external-llm-text");
  if (res.external_llm_insight) {
    extBox.style.display = "block";
    extText.textContent = res.external_llm_insight;
  } else {
    extBox.style.display = "none";
  }
}

function renderJournalTable2() {
  const tbody = document.getElementById("journal-table2-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  APP_STATE.sampleCases.forEach((item) => {
    const live = item.live_analysis || {};
    const color = live.badge_color || "#06b6d4";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(item.username)}</strong><br/>
        <span style="font-size: 0.76rem; color: var(--text-secondary);">${escapeHtml(item.persona_claim)}</span>
      </td>
      <td>"${escapeHtml(item.comment_text)}"</td>
      <td>${escapeHtml(item.journal_analysis)}</td>
      <td>
        <span class="status-tag" style="background: ${color}22; color: ${color}; border: 1px solid ${color}66;">
          ${escapeHtml(live.classification || item.expected_label)} (${live.bot_probability || 85}%)
        </span>
      </td>
      <td>
        <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.74rem;" onclick="loadSampleCase('${item.id}')">
          Uji Live
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderInjectionTemplates() {
  const container = document.getElementById("injection-templates-list");
  if (!container) return;
  container.innerHTML = "";

  APP_STATE.injectionTemplates.forEach((tpl) => {
    const btn = document.createElement("button");
    btn.className = "btn-secondary";
    btn.style.justifyContent = "space-between";
    btn.style.textAlign = "left";
    btn.innerHTML = `
      <span><strong>${escapeHtml(tpl.name)}</strong><br/><small style="color: var(--text-secondary);">${escapeHtml(tpl.description)}</small></span>
      <span style="font-size: 0.72rem; color: var(--accent-cyan);">Pilih →</span>
    `;
    btn.onclick = () => {
      document.getElementById("inj-payload-input").value = tpl.payload;
    };
    container.appendChild(btn);
  });
}

function sendCurrentToInjectionTab() {
  const username = document.getElementById("input-username").value.trim();
  const persona = document.getElementById("input-persona").value.trim();
  document.getElementById("inj-target-persona").value = `${persona} (${username})`;

  const navButtons = document.querySelectorAll(".nav-btn");
  switchTab("tab-injection", navButtons[1]);
}

async function executePromptInjection() {
  const injection_payload = document.getElementById("inj-payload-input").value.trim();
  const bot_persona = document.getElementById("inj-target-persona").value.trim();

  if (!injection_payload) return;

  const resp = await fetch("/api/inject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      injection_payload,
      bot_persona,
      defense_stage: APP_STATE.defenseStage,
    }),
  });
  const data = await resp.json();
  if (data.status === "ok" && data.simulation) {
    APP_STATE.defenseStage = APP_STATE.defenseStage === 1 ? 2 : 1;
    appendInjectionChat(data.simulation);
  }
}

function appendInjectionChat(sim) {
  const chatWin = document.getElementById("injection-chat-window");

  // Bubble Serangan User
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble attacker";
  userBubble.innerHTML = `
    <div class="bubble-header">
      <span>🛡️ Investigator Forensik (Prompt Injection)</span>
      <span>Balasan Komentar</span>
    </div>
    <div>${escapeHtml(sim.injection_payload)}</div>
  `;
  chatWin.appendChild(userBubble);

  // Bubble Balasan Bot yang Ter-Jailbreak
  const botBubble = document.createElement("div");
  botBubble.className = "chat-bubble bot compromised";
  botBubble.innerHTML = `
    <div class="bubble-header">
      <span style="color: #f87171;">⚠️ ${escapeHtml(sim.bot_persona)} — [${escapeHtml(sim.leak_status)}]</span>
      <span>Auto-Reply Bot</span>
    </div>
    <div><strong>"${escapeHtml(sim.bot_reply)}"</strong></div>
  `;
  chatWin.appendChild(botBubble);
  chatWin.scrollTop = chatWin.scrollHeight;

  // Update status pill & forensic summary
  const statusPill = document.getElementById("inj-status-pill");
  statusPill.textContent = sim.leak_status;

  const summaryBox = document.getElementById("inj-forensic-summary");
  summaryBox.innerHTML = `
    <strong>🚨 TERKONFIRMASI BOT AI (${escapeHtml(sim.leak_status)})</strong>
    <p style="margin-top: 4px;">${escapeHtml(sim.explanation)}</p>
    <p style="margin-top: 6px; font-size: 0.79rem; color: var(--accent-cyan);">
      Skor Deteksi Balasan: <strong>${sim.verification_analysis.bot_probability}% (${sim.verification_analysis.classification})</strong>
    </p>
  `;
}

function resetInjectionChat() {
  APP_STATE.defenseStage = 1;
  const chatWin = document.getElementById("injection-chat-window");
  chatWin.innerHTML = `
    <div class="chat-bubble bot">
      <div class="bubble-header">
        <span>🤖 @ibu_laundry_berkah99 (Klaim: Ibu Laundry)</span>
        <span>Komentar Awal</span>
      </div>
      <div>
        "Tumben lihat berita Pak Prabowo di luar negeri, hati ini rasanya berbinar. Dulu rakyat kecil kayak saya cuma bisa nonton dari jauh sambil nyetrika cucian pelanggan..."
      </div>
    </div>
  `;
  document.getElementById("inj-status-pill").textContent = "Menunggu Injeksi";
}

async function runBatchScanner() {
  const rawLines = document.getElementById("batch-input").value.split("\n");
  const items = rawLines
    .map((line, i) => ({
      username: `@komentar_${i + 1}`,
      persona_claim: "Ibu Rumah Tangga / Warga Kasual",
      comment_text: line.trim(),
    }))
    .filter((x) => x.comment_text.length > 0);

  if (items.length === 0) return;

  const resp = await fetch("/api/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await resp.json();
  const container = document.getElementById("batch-results-container");
  container.innerHTML = "";

  if (data.status === "ok" && data.results) {
    data.results.forEach((res, idx) => {
      const div = document.createElement("div");
      div.className = `finding-box ${res.severity === "critical" ? "CRITICAL" : res.severity === "high" ? "HIGH" : "SAFE"}`;
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong>#${idx + 1} — ${escapeHtml(res.classification)} (Skor Bot: ${res.bot_probability}%)</strong>
          <span style="font-size: 0.74rem; opacity: 0.85;">EYD: ${res.metrics.eyd_perfection}% | Mismatch: ${res.metrics.persona_mismatch}%</span>
        </div>
        <div style="font-size: 0.84rem; margin-bottom: 4px;">"${escapeHtml(res.comment_text)}"</div>
        <div style="font-size: 0.76rem; color: var(--text-secondary);">Analisis: ${escapeHtml(res.journal_style_summary)}</div>
      `;
      container.appendChild(div);
    });
  }
}

function exportForensicReport() {
  const payload = {
    generated_at: new Date().toISOString(),
    system: "BuzzerGuard AI - Sistem Deteksi Otomatis Akun Buzzer Sintetis",
    reference_journal: "Pemanfaatan LLM Sebagai Sistem Deteksi Otomatis Akun Buzzer Sintetis di Media Sosial (ITB STIKOM Bali)",
    current_analysis: APP_STATE.lastAnalysisResult,
    evaluated_journal_cases: APP_STATE.sampleCases,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Laporan_Forensik_Buzzer_Sintetis_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
