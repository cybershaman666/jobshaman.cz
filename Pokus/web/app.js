const state = {
  jobs: [],
  selectedJobId: null,
  latestDraft: "",
  profileLoaded: false,
};

const elements = {
  healthStatus: document.querySelector("#health-status"),
  modeStatus: document.querySelector("#mode-status"),
  ollamaStatus: document.querySelector("#ollama-status"),
  selectedJobStatus: document.querySelector("#selected-job-status"),
  limitInput: document.querySelector("#limit-input"),
  llmToggle: document.querySelector("#llm-toggle"),
  fetchBtn: document.querySelector("#fetch-btn"),
  recommendBtn: document.querySelector("#recommend-btn"),
  draftBtn: document.querySelector("#draft-btn"),
  applyBtn: document.querySelector("#apply-btn"),
  copyBtn: document.querySelector("#copy-btn"),
  jobsList: document.querySelector("#jobs-list"),
  resultsMeta: document.querySelector("#results-meta"),
  resultCount: document.querySelector("#result-count"),
  jobDetail: document.querySelector("#job-detail"),
  draftOutput: document.querySelector("#draft-output"),
  applyOutput: document.querySelector("#apply-output"),
  activityLog: document.querySelector("#activity-log"),
  jobshamanReport: document.querySelector("#jobshaman-report"),
  wwrReport: document.querySelector("#wwr-report"),
  resumeInput: document.querySelector("#resume-input"),
  preferencesInput: document.querySelector("#preferences-input"),
  loadProfileBtn: document.querySelector("#load-profile-btn"),
  suggestProfileBtn: document.querySelector("#suggest-profile-btn"),
  saveProfileBtn: document.querySelector("#save-profile-btn"),
  cardTemplate: document.querySelector("#job-card-template"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }
  return response.json();
}

function log(message) {
  const stamp = new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  elements.activityLog.textContent = `[${stamp}] ${message}\n` + elements.activityLog.textContent;
}

function currentLimit() {
  return Math.max(1, Number(elements.limitInput.value || 30));
}

function currentUseLlm() {
  return elements.llmToggle.checked;
}

function setBusy(button, busyText) {
  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  return () => {
    button.disabled = false;
    button.textContent = previousText;
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderJobs(items) {
  state.jobs = items;
  elements.jobsList.innerHTML = "";
  elements.resultCount.textContent = String(items.length);
  elements.resultsMeta.textContent = items.length
    ? `${items.length} pozic prošlo minimálním match score.`
    : "Nic neprošlo filtrem nebo zatím není cache.";

  if (!items.length) {
    elements.jobsList.classList.add("empty");
    elements.jobsList.innerHTML = "<p>Není co zobrazit. Zkus fetch nebo upravit preference.</p>";
    return;
  }

  elements.jobsList.classList.remove("empty");
  for (const item of items) {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".job-card");
    fragment.querySelector(".source-badge").textContent = item.job.source;
    fragment.querySelector(".score-badge").textContent = `${item.match_score}%`;
    fragment.querySelector(".job-title").textContent = item.job.title;
    fragment.querySelector(".job-company").textContent = item.job.company;
    fragment.querySelector(".job-meta").textContent = [item.job.location || "No location", item.job.remote ? "remote" : "non-remote"]
      .filter(Boolean)
      .join(" • ");

    const reasonList = fragment.querySelector(".reason-list");
    for (const reason of item.reasons || []) {
      const tag = document.createElement("span");
      tag.className = "reason-tag";
      tag.textContent = reason;
      reasonList.appendChild(tag);
    }

    card.addEventListener("click", () => selectJob(item.job.id));
    if (state.selectedJobId === item.job.id) {
      card.classList.add("active");
    }
    elements.jobsList.appendChild(fragment);
  }
}

function renderFetchReport(report) {
  const js = report?.jobshaman || {};
  const wwr = report?.weworkremotely || {};
  elements.jobshamanReport.textContent = js.error ? `error: ${js.error}` : `${js.count || 0} jobs`;
  elements.wwrReport.textContent = wwr.error ? `error: ${wwr.error}` : `${wwr.count || 0} jobs`;
}

function renderSelectedJob() {
  const item = state.jobs.find((entry) => entry.job.id === state.selectedJobId);
  if (!item) {
    elements.selectedJobStatus.textContent = "none";
    elements.jobDetail.className = "job-detail empty";
    elements.jobDetail.innerHTML = "<p>Ještě není vybraná žádná pozice.</p>";
    elements.draftBtn.disabled = true;
    elements.applyBtn.disabled = true;
    elements.copyBtn.disabled = true;
    return;
  }

  elements.selectedJobStatus.textContent = item.job.title;
  elements.jobDetail.className = "job-detail";
  elements.jobDetail.innerHTML = `
    <div class="detail-head">
      <div>
        <h3>${escapeHtml(item.job.title)}</h3>
        <p>${escapeHtml(item.job.company)}</p>
      </div>
      <div class="pill">${item.match_score}%</div>
    </div>
    <div class="detail-meta">
      <div>Zdroj: ${escapeHtml(item.job.source)}</div>
      <div>Lokace: ${escapeHtml(item.job.location || "neuvedena")}</div>
      <div>Remote: ${item.job.remote ? "ano" : "ne"}</div>
      <div>Apply URL: ${item.job.apply_url ? `<a href="${escapeHtml(item.job.apply_url)}" target="_blank" rel="noreferrer">open</a>` : "není"}</div>
    </div>
    <div class="detail-reasons">
      ${(item.reasons || []).map((reason) => `<span class="reason-tag">${escapeHtml(reason)}</span>`).join("")}
    </div>
    <div class="detail-warnings">
      ${(item.warnings || []).map((warning) => `<span class="warning-tag">${escapeHtml(warning)}</span>`).join("")}
    </div>
  `;
  elements.draftBtn.disabled = false;
  elements.applyBtn.disabled = false;
}

function selectJob(jobId) {
  state.selectedJobId = jobId;
  renderJobs(state.jobs);
  renderSelectedJob();
}

async function checkHealth() {
  try {
    await api("/health");
    elements.healthStatus.textContent = "online";
  } catch {
    elements.healthStatus.textContent = "offline";
  }
}

async function checkLlmStatus() {
  try {
    const data = await api("/llm/status");
    if (!data.reachable) {
      elements.ollamaStatus.textContent = "offline";
      if (data.error) log(`Ollama chyba: ${data.error}`);
      return;
    }
    if (!data.model_available) {
      elements.ollamaStatus.textContent = "model missing";
      const available = (data.available_models || []).join(", ");
      log(`Ollama běží, ale model ${data.model} není dostupný. Dostupné: ${available}`);
      return;
    }
    elements.ollamaStatus.textContent = "ready";
  } catch (error) {
    elements.ollamaStatus.textContent = "offline";
    log(`Ollama status selhal: ${error.message}`);
  }
}

async function loadProfile() {
  const release = setBusy(elements.loadProfileBtn, "Loading...");
  try {
    const data = await api("/profile");
    elements.resumeInput.value = data.resume || "";
    elements.preferencesInput.value = data.preferences || "";
    state.profileLoaded = true;
    log("Profil načtený z disku.");
  } catch (error) {
    log(`Načtení profilu selhalo: ${error.message}`);
  } finally {
    release();
  }
}

async function saveProfile() {
  const release = setBusy(elements.saveProfileBtn, "Saving...");
  try {
    await api("/profile", {
      method: "PUT",
      body: JSON.stringify({
        resume: elements.resumeInput.value,
        preferences: elements.preferencesInput.value,
      }),
    });
    state.profileLoaded = true;
    log("Profil uložený. Doporučení teď poběží nad novým CV a preferencemi.");
  } catch (error) {
    log(`Uložení profilu selhalo: ${error.message}`);
  } finally {
    release();
  }
}

async function suggestPreferences() {
  const release = setBusy(elements.suggestProfileBtn, "Suggesting...");
  try {
    const data = await api("/profile/suggest-preferences", {
      method: "POST",
      body: JSON.stringify({ use_llm: currentUseLlm() }),
    });
    elements.preferencesInput.value = data.preferences || "";
    const source = data.source || "heuristic";
    log(`Preference návrh hotový. Zdroj: ${source}.`);
    if (data.llm?.error && currentUseLlm()) {
      log(`LLM fallback při návrhu preferencí: ${data.llm.error}`);
    }
  } catch (error) {
    log(`Návrh preferencí selhal: ${error.message}`);
  } finally {
    release();
  }
}

async function fetchJobs() {
  const release = setBusy(elements.fetchBtn, "Fetching...");
  try {
    const data = await api(`/jobs/fetch?limit=${currentLimit()}`, { method: "POST" });
    renderFetchReport(data.report || {});
    log(`Fetch hotový. Staženo ${data.jobs.length} nabídek.`);
    if (data.report?.jobshaman?.error) {
      log(`JobShaman chyba: ${data.report.jobshaman.error}`);
    }
    if (data.report?.weworkremotely?.error) {
      log(`WWR chyba: ${data.report.weworkremotely.error}`);
    }
    elements.modeStatus.textContent = "dry-run";
  } catch (error) {
    log(`Fetch selhal: ${error.message}`);
  } finally {
    release();
  }
}

async function recommendJobs() {
  const release = setBusy(elements.recommendBtn, "Scoring...");
  try {
    const query = new URLSearchParams({
      limit: String(currentLimit()),
      use_llm: String(currentUseLlm()),
    });
    const data = await api(`/jobs/recommendations?${query}`);
    renderJobs(data.items || []);
    renderSelectedJob();
    log(`Scoring dokončen. ${data.items.length} pozic nad limitem.`);
    if (currentUseLlm() && data.llm?.error) {
      log(`LLM fallback: ${data.llm.error}`);
    }
    if (currentUseLlm() && data.llm && data.llm.model_available === false) {
      log(`LLM model chybí: ${data.llm.model}`);
    }
  } catch (error) {
    log(`Recommend selhal: ${error.message}`);
  } finally {
    release();
  }
}

async function generateDraft() {
  if (!state.selectedJobId) return;
  const release = setBusy(elements.draftBtn, "Drafting...");
  try {
    const query = new URLSearchParams({ use_llm: String(currentUseLlm()) });
    const data = await api(`/jobs/${state.selectedJobId}/draft?${query}`);
    state.latestDraft = data.message || "";
    elements.draftOutput.value = state.latestDraft;
    elements.copyBtn.disabled = !state.latestDraft;
    log(`Draft vygenerovaný pro job ${state.selectedJobId}.`);
  } catch (error) {
    log(`Draft selhal: ${error.message}`);
  } finally {
    release();
  }
}

async function applyToJob() {
  if (!state.selectedJobId) return;
  const release = setBusy(elements.applyBtn, "Applying...");
  try {
    const query = new URLSearchParams({ use_llm: String(currentUseLlm()) });
    const data = await api(`/jobs/${state.selectedJobId}/apply?${query}`, { method: "POST" });
    elements.applyOutput.textContent = JSON.stringify(data, null, 2);
    elements.modeStatus.textContent = data.mode;
    log(`Apply akce dokončena v režimu ${data.mode}.`);
  } catch (error) {
    log(`Apply selhal: ${error.message}`);
  } finally {
    release();
  }
}

async function copyDraft() {
  if (!state.latestDraft) return;
  await navigator.clipboard.writeText(state.latestDraft);
  log("Draft zkopírovaný do schránky.");
}

elements.fetchBtn.addEventListener("click", fetchJobs);
elements.recommendBtn.addEventListener("click", recommendJobs);
elements.draftBtn.addEventListener("click", generateDraft);
elements.applyBtn.addEventListener("click", applyToJob);
elements.copyBtn.addEventListener("click", copyDraft);
elements.loadProfileBtn.addEventListener("click", loadProfile);
elements.suggestProfileBtn.addEventListener("click", suggestPreferences);
elements.saveProfileBtn.addEventListener("click", saveProfile);

checkHealth();
checkLlmStatus();
loadProfile();
log("Dashboard připravený.");
