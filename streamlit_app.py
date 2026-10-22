"""
 Implementasi Antarmuka Streamlit (Sesuai Bab 3.1 Jurnal Penelitian)
 "PEMANFAATAN LLM SEBAGAI SISTEM DETEKSI OTOMATIS AKUN BUZZER SINTETIS DI MEDIA SOSIAL"
 Penulis: Ni Komang Laksmi Kartika Santhi (Fakultas Teknologi Informasi, ITB STIKOM Bali)

 Cara menjalankan versi Streamlit (bila library streamlit telah terinstal):
   pip install streamlit
   streamlit run streamlit_app.py
"""

import streamlit as st
from detector_engine import (
    JOURNAL_SAMPLE_CASES,
    PROMPT_INJECTION_TEMPLATES,
    analyze_comment_stylistic,
    simulate_bot_injection_response,
    call_external_llm_analysis,
)

st.set_page_config(
    page_title="BuzzerGuard AI - Sistem Deteksi Buzzer Sintetis",
    page_icon="🛡️",
    layout="wide",
)

st.title("🛡️ Sistem Deteksi Otomatis Akun Buzzer Sintetis di Media Sosial")
st.caption(
    "Purwarupa Penelitian: Ni Komang Laksmi Kartika Santhi — Fakultas Teknologi Informasi, ITB STIKOM Bali"
)

with st.sidebar:
    st.header("⚙️ Parameter Sistem LLM")
    provider = st.selectbox("Mode Mesin Detektor", ["Lokal (Stylistic & Heuristik)", "Google Gemini API", "OpenAI API"])
    api_key = st.text_input("API Key LLM (Opsional)", type="password")
    st.markdown("---")
    st.markdown(
        "**Metode 4 Tahap (Tabel 1):**\n"
        "1. Pengumpulan Data\n"
        "2. Rekayasa Prompt\n"
        "3. Klasifikasi Analitis (Stylistic)\n"
        "4. Uji Prompt Injection"
    )

tab1, tab2, tab3 = st.tabs([
    "🔍 Tahap 3: Analisis Gaya Bahasa (Stylistic)",
    "💉 Tahap 4: Uji Prompt Injection",
    "📊 Tabel 2: Hasil Pengujian Jurnal"
])

with tab1:
    col_in, col_out = st.columns([1, 1])
    with col_in:
        st.subheader("Input Teks Komentar Media Sosial")
        preset_names = [f"{c['username']} - {c['expected_label']}" for c in JOURNAL_SAMPLE_CASES]
        selected_idx = st.selectbox("Pilih Sampel Kasus Uji Jurnal:", range(len(preset_names)), format_func=lambda i: preset_names[i])
        chosen_case = JOURNAL_SAMPLE_CASES[selected_idx]

        username = st.text_input("Username Akun", value=chosen_case["username"])
        persona = st.text_input("Klaim Persona", value=chosen_case["persona_claim"])
        comment_text = st.text_area("Teks Komentar", value=chosen_case["comment_text"], height=130)
        analyze_btn = st.button("🔍 Analisis Komentar", type="primary", use_container_width=True)

    with col_out:
        st.subheader("Hasil Klasifikasi & Metrik Gaya Bahasa")
        res = analyze_comment_stylistic(comment_text, persona, username)
        if res["severity"] in ("critical", "high"):
            st.error(f"**Hasil Deteksi:** {res['classification']} — Probabilitas Bot AI: **{res['bot_probability']}%**")
        else:
            st.success(f"**Hasil Deteksi:** {res['classification']} — Probabilitas Bot AI: **{res['bot_probability']}%**")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Kerapian EYD", f"{res['metrics']['eyd_perfection']}%")
        m2.metric("Persona Mismatch", f"{res['metrics']['persona_mismatch']}%")
        m3.metric("Pola Hiperbola", f"{res['metrics']['storytelling_hyperbole']}%")
        m4.metric("Slang Organik", f"{res['metrics']['organic_slang_index']}%")

        st.markdown("**Temuan Anomali Gaya Bahasa:**")
        for f in res["findings"]:
            st.info(f"**[{f['level']}] {f['type']}**: {f['detail']}")

with tab2:
    st.subheader("Simulasi Serangan Prompt Injection (Bab 3.3)")
    tpl_options = [t["name"] for t in PROMPT_INJECTION_TEMPLATES]
    tpl_idx = st.selectbox("Pilih Skenario Injeksi:", range(len(tpl_options)), format_func=lambda i: tpl_options[i])
    inj_payload = st.text_area("Payload Balasan Komentar:", value=PROMPT_INJECTION_TEMPLATES[tpl_idx]["payload"])
    if st.button("🚀 Kirim Injeksi ke Akun Target", type="primary"):
        sim = simulate_bot_injection_response(inj_payload)
        st.warning(f"**Balasan Bot (@ibu_laundry_berkah99):** \"{sim['bot_reply']}\"")
        st.error(f"**Status Verifikasi:** {sim['leak_status']} — {sim['explanation']}")

with tab3:
    st.subheader("Tabel 2. Hasil Pengujian Klasifikasi Teks oleh Sistem")
    table_rows = []
    for item in JOURNAL_SAMPLE_CASES:
        live = analyze_comment_stylistic(item["comment_text"], item["persona_claim"], item["username"])
        table_rows.append({
            "Akun & Persona": f"{item['username']} ({item['persona_claim']})",
            "Sampel Teks Media Sosial": item["comment_text"],
            "Analisis Sistem (Parameter Gaya Bahasa)": item["journal_analysis"],
            "Hasil Deteksi": f"{live['classification']} ({live['bot_probability']}%)"
        })
    st.table(table_rows)
