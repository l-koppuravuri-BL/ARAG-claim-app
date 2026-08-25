// ================= CONFIGURATION =================
const CONFIG = {
  // Replace with your Google OAuth Client ID
  GOOGLE_CLIENT_ID: "997954739848-fgla72dccagbrr2fnlv2ub8ofuhjskr1.apps.googleusercontent.com",

  // Replace with your deployed AWS API Gateway endpoint URL (e.g. https://xxxx.execute-api.region.amazonaws.com)
  API_BASE: "https://grcobs30df.execute-api.eu-central-1.amazonaws.com"
};

// ================= STATE MANAGEMENT =================
const state = {
  token: sessionStorage.getItem("claims_tracker_token") || null,
  user: JSON.parse(sessionStorage.getItem("claims_tracker_user")) || null,
  claims: [],
  filteredClaims: [],
  activeFilter: "all",
  searchQuery: "",
  editingClaimId: null
};

// ================= DOM ELEMENTS =================
const el = {
  authScreen: document.getElementById("auth-screen"),
  appScreen: document.getElementById("app-screen"),
  authError: document.getElementById("auth-error"),
  devLoginBtn: document.getElementById("dev-login-btn"),

  userAvatar: document.getElementById("user-avatar"),
  userName: document.getElementById("user-name"),
  userEmail: document.getElementById("user-email"),
  logoutBtn: document.getElementById("logout-btn"),

  openAddModalBtn: document.getElementById("open-add-modal-btn"),
  emptyAddBtn: document.getElementById("empty-add-btn"),
  claimModal: document.getElementById("claim-modal"),
  claimForm: document.getElementById("claim-form"),
  modalTitle: document.getElementById("modal-title"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  cancelModalBtn: document.getElementById("cancel-modal-btn"),

  formClaimId: document.getElementById("form-claim-id"),
  formClaimNumber: document.getElementById("form-claim-number"),
  formServiceDate: document.getElementById("form-service-date"),
  formProvider: document.getElementById("form-provider"),
  formSubmissionDate: document.getElementById("form-submission-date"),
  formDescription: document.getElementById("form-description"),
  formAmountSubmitted: document.getElementById("form-amount-submitted"),
  formStatus: document.getElementById("form-status"),
  approvalDetails: document.getElementById("approval-details"),
  formAmountApproved: document.getElementById("form-amount-approved"),
  formReimbursementDate: document.getElementById("form-reimbursement-date"),
  formComments: document.getElementById("form-comments"),
  saveClaimBtn: document.getElementById("save-claim-btn"),

  detailsModal: document.getElementById("details-modal"),
  closeDetailsBtn: document.getElementById("close-details-btn"),
  detailCloseBtn: document.getElementById("detail-close-btn"),
  detailEditBtn: document.getElementById("detail-edit-btn"),
  detailDeleteBtn: document.getElementById("detail-delete-btn"),

  detailProvider: document.getElementById("detail-provider"),
  detailDesc: document.getElementById("detail-desc"),
  detailStatus: document.getElementById("detail-status"),
  detailNumber: document.getElementById("detail-number"),
  detailServiceDate: document.getElementById("detail-service-date"),
  detailSubmissionDate: document.getElementById("detail-submission-date"),
  detailReimbursementDate: document.getElementById("detail-reimbursement-date"),
  detailAmountSubmitted: document.getElementById("detail-amount-submitted"),
  detailAmountApproved: document.getElementById("detail-amount-approved"),
  detailUncovered: document.getElementById("detail-uncovered"),
  detailCoverageBar: document.getElementById("detail-coverage-bar"),
  detailCoverageRatio: document.getElementById("detail-coverage-ratio"),
  detailCommentsContainer: document.getElementById("detail-comments-container"),
  detailComments: document.getElementById("detail-comments"),

  statTotalSubmitted: document.getElementById("stat-total-submitted"),
  statCountTotal: document.getElementById("stat-count-total"),
  statTotalApproved: document.getElementById("stat-total-approved"),
  statRateValue: document.getElementById("stat-rate-value"),
  statTotalPending: document.getElementById("stat-total-pending"),
  statCountPending: document.getElementById("stat-count-pending"),
  statReimbursementRate: document.getElementById("stat-reimbursement-rate"),
  statProgressBar: document.getElementById("stat-progress-bar"),

  searchInput: document.getElementById("search-input"),
  filterTabs: document.querySelectorAll(".filter-tab"),
  loadingSpinner: document.getElementById("loading-spinner"),
  emptyState: document.getElementById("empty-state"),
  claimsGrid: document.getElementById("claims-grid")
};

// ================= APP INITIALIZATION =================
window.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkEnvironment();

  if (state.token && state.user) {
    showAppScreen();
    fetchClaims();
  } else {
    showAuthScreen();
    initGoogleOAuth();
  }
});

// Show dev login button if running on localhost
function checkEnvironment() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.")) {
    el.devLoginBtn.classList.remove("hidden");
  }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
  // Logout
  el.logoutBtn.addEventListener("click", handleLogout);

  // Dev Login Bypass
  el.devLoginBtn.addEventListener("click", handleDevLogin);

  // Modal Open/Close
  el.openAddModalBtn.addEventListener("click", () => openClaimModal());
  el.emptyAddBtn.addEventListener("click", () => openClaimModal());
  el.closeModalBtn.addEventListener("click", closeClaimModal);
  el.cancelModalBtn.addEventListener("click", closeClaimModal);
  el.closeDetailsBtn.addEventListener("click", closeDetailsModal);
  el.detailCloseBtn.addEventListener("click", closeDetailsModal);

  // Form submission
  el.claimForm.addEventListener("submit", handleFormSubmit);

  // Toggle conditional form fields based on status
  el.formStatus.addEventListener("change", toggleFormFields);

  // Filtering & Searching
  el.searchInput.addEventListener("input", handleSearch);

  el.filterTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      el.filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      state.activeFilter = tab.dataset.status;
      applyFilters();
    });
  });
}

// ================= AUTHENTICATION FLOW =================
function initGoogleOAuth() {
  if (CONFIG.GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com") {
    console.warn("Please configure your GOOGLE_CLIENT_ID in app.js");
  }

  try {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(
      el.googleLoginBtn,
      { theme: "filled_dark", size: "large", width: "320" }
    );
  } catch (err) {
    console.error("Google Identity Services failed to load:", err);
    el.authError.innerText = "Error loading Google Sign-In. Check internet connection.";
    el.authError.classList.remove("hidden");
  }
}

async function handleCredentialResponse(response) {
  const idToken = response.credential;
  try {
    el.authError.classList.add("hidden");

    // Verify token with backend
    const res = await fetch(`${CONFIG.API_BASE}/claims`, {
      headers: { "Authorization": `Bearer ${idToken}` }
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Access Denied: Your email is not on the allowed access list.");
      }
      throw new Error("Failed to authenticate with server.");
    }

    // Decode token locally to get profile info
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));

    state.token = idToken;
    state.user = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture
    };

    // Persist
    sessionStorage.setItem("claims_tracker_token", state.token);
    sessionStorage.setItem("claims_tracker_user", JSON.stringify(state.user));

    showAppScreen();
    // Use claims data returned from verification fetch
    state.claims = await res.json();
    renderClaims();
    renderStats();
  } catch (err) {
    console.error("Login verification failed:", err);
    el.authError.innerText = err.message;
    el.authError.classList.remove("hidden");
  }
}

// Development Bypass Login
function handleDevLogin() {
  state.token = "dev-token";
  state.user = {
    name: "Development User",
    email: "dev-user@example.com",
    picture: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
  };

  sessionStorage.setItem("claims_tracker_token", state.token);
  sessionStorage.setItem("claims_tracker_user", JSON.stringify(state.user));

  showAppScreen();
  fetchClaims();
}

function handleLogout() {
  sessionStorage.clear();
  state.token = null;
  state.user = null;
  state.claims = [];
  state.filteredClaims = [];

  showAuthScreen();
  // Reinit Google button
  setTimeout(initGoogleOAuth, 100);
}

function showAuthScreen() {
  el.appScreen.classList.remove("active");
  el.authScreen.classList.add("active");
}

function showAppScreen() {
  el.authScreen.classList.remove("active");
  el.appScreen.classList.add("active");

  // Render user profile info
  el.userAvatar.src = state.user.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
  el.userName.innerText = state.user.name;
  el.userEmail.innerText = state.user.email;
}

// ================= API CALLS =================
async function fetchClaims() {
  el.loadingSpinner.classList.remove("hidden");
  el.claimsGrid.classList.add("hidden");
  el.emptyState.classList.add("hidden");

  try {
    const res = await fetch(`${CONFIG.API_BASE}/claims`, {
      headers: { "Authorization": `Bearer ${state.token}` }
    });

    if (res.status === 401 || res.status === 403) {
      handleLogout();
      return;
    }

    if (!res.ok) throw new Error("Could not retrieve claims from server.");

    state.claims = await res.json();
    renderClaims();
    renderStats();
  } catch (err) {
    console.error("Fetch claims error:", err);
    alert(err.message);
  } finally {
    el.loadingSpinner.classList.add("hidden");
  }
}

// ================= RENDER METHODS =================
function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function getStatusLabel(status) {
  switch (status) {
    case "Submitted": return "Submitted";
    case "Approved": return "Approved";
    case "Partially Approved": return "Partial";
    case "Rejected": return "Rejected";
    case "Pending Info": return "Pending Info";
    default: return status;
  }
}

function getStatusClass(status) {
  return (status || "").toLowerCase().replace(" ", "_");
}

function renderClaims() {
  applyFilters();
}

function applyFilters() {
  let filtered = [...state.claims];

  // Status Filter
  if (state.activeFilter !== "all") {
    filtered = filtered.filter(c => c.status === state.activeFilter);
  }

  // Search Filter
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      (c.provider && c.provider.toLowerCase().includes(query)) ||
      (c.description && c.description.toLowerCase().includes(query)) ||
      (c.claimNumber && c.claimNumber.toLowerCase().includes(query)) ||
      (c.comments && c.comments.toLowerCase().includes(query))
    );
  }

  // Sort by serviceDate descending (newest first)
  filtered.sort((a, b) => new Date(b.serviceDate) - new Date(a.serviceDate));
  state.filteredClaims = filtered;

  if (filtered.length === 0) {
    el.claimsGrid.classList.add("hidden");
    el.emptyState.classList.remove("hidden");
  } else {
    el.emptyState.classList.add("hidden");
    el.claimsGrid.classList.remove("hidden");

    el.claimsGrid.innerHTML = "";
    filtered.forEach(claim => {
      const card = createClaimCard(claim);
      el.claimsGrid.appendChild(card);
    });
  }
}

function createClaimCard(claim) {
  const card = document.createElement("div");
  card.className = "claim-card";
  card.dataset.id = claim.id;

  const statusClass = getStatusClass(claim.status);
  const statusLabel = getStatusLabel(claim.status);
  const submittedVal = parseFloat(claim.amountSubmitted || 0);
  const approvedVal = parseFloat(claim.amountApproved || 0);
  const outOfPocketVal = Math.max(0, submittedVal - approvedVal);

  // Coverage Ratio Percentage
  const coveragePercent = submittedVal > 0 ? (approvedVal / submittedVal) * 100 : 0;

  let commentsBadge = "";
  if (claim.comments) {
    commentsBadge = `
      <div class="claim-comments-badge">
        <i class="fa-solid fa-comment-dots"></i>
        <span>${claim.comments}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="claim-card-header">
      <div class="claim-provider-info">
        <span class="claim-provider">${claim.provider}</span>
        <span class="claim-number">No: ${claim.claimNumber || "N/A"}</span>
      </div>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
    </div>
    
    <p class="claim-desc">${claim.description || "No description provided."}</p>
    
    <div class="claim-meta">
      <div class="claim-meta-item">
        <i class="fa-regular fa-calendar"></i>
        <span>${formatDate(claim.serviceDate)}</span>
      </div>
      <div class="claim-meta-item">
        <i class="fa-solid fa-file-export"></i>
        <span>Sent: ${formatDate(claim.submissionDate)}</span>
      </div>
    </div>
    
    <div class="claim-financials">
      <div class="financial-row">
        <span class="financial-label">Invoiced:</span>
        <span class="financial-value total">${formatCurrency(submittedVal)}</span>
      </div>
      
      ${claim.status === "Approved" || claim.status === "Partially Approved" ? `
        <div class="financial-row">
          <span class="financial-label">Approved Portion:</span>
          <span class="financial-value approved">${formatCurrency(approvedVal)}</span>
        </div>
        <div class="claim-progress-track">
          <div class="claim-progress-fill" style="width: ${coveragePercent}%"></div>
        </div>
        ${outOfPocketVal > 0 ? `
          <div class="financial-row">
            <span class="financial-label">Uncovered Out-of-Pocket:</span>
            <span class="financial-value out-of-pocket">${formatCurrency(outOfPocketVal)}</span>
          </div>
        ` : ""}
      ` : ""}
    </div>
    
    ${commentsBadge}
  `;

  // Card click opens details modal
  card.addEventListener("click", (e) => {
    // Avoid triggering if clicking on buttons within card if any (none currently)
    openDetailsModal(claim);
  });

  return card;
}

function renderStats() {
  const totalClaims = state.claims.length;

  let totalSubmitted = 0;
  let totalApproved = 0;
  let totalPending = 0;
  let pendingCount = 0;
  let finalizedSubmitted = 0; // submitted total for approved/partially/rejected claims

  state.claims.forEach(claim => {
    const sub = parseFloat(claim.amountSubmitted || 0);
    const appr = parseFloat(claim.amountApproved || 0);

    totalSubmitted += sub;

    if (claim.status === "Submitted" || claim.status === "Pending Info") {
      totalPending += sub;
      pendingCount++;
    } else {
      totalApproved += appr;
      finalizedSubmitted += sub;
    }
  });

  // Calculate overall recovery rate (Approved amount over total finalized submitted amount)
  // If no claims are finalized yet, default to 0%
  const recoveryRate = finalizedSubmitted > 0 ? (totalApproved / finalizedSubmitted) * 100 : 0;

  el.statTotalSubmitted.innerText = formatCurrency(totalSubmitted);
  el.statCountTotal.innerText = `${totalClaims} Claims Total`;

  el.statTotalApproved.innerText = formatCurrency(totalApproved);
  el.statRateValue.innerText = `${totalClaims > 0 ? ((state.claims.filter(c => c.status === "Approved" || c.status === "Partially Approved").length / totalClaims) * 100).toFixed(0) : 0}% Approved`;

  el.statTotalPending.innerText = formatCurrency(totalPending);
  el.statCountPending.innerText = `${pendingCount} Pending Claims`;

  el.statReimbursementRate.innerText = `${recoveryRate.toFixed(1)}%`;
  el.statProgressBar.style.width = `${recoveryRate}%`;
}

// ================= MODAL OPERATIONS =================
function toggleFormFields() {
  const status = el.formStatus.value;
  if (status === "Approved" || status === "Partially Approved") {
    el.approvalDetails.classList.remove("hidden");

    // Auto fill approved amount if empty
    if (!el.formAmountApproved.value && status === "Approved") {
      el.formAmountApproved.value = el.formAmountSubmitted.value;
    }
  } else {
    el.approvalDetails.classList.add("hidden");
    el.formAmountApproved.value = "";
    el.formReimbursementDate.value = "";
  }
}

function openClaimModal(claim = null) {
  state.editingClaimId = claim ? claim.id : null;
  el.claimForm.reset();

  // Set defaults for Dates (today)
  const today = new Date().toISOString().substring(0, 10);
  el.formServiceDate.value = today;
  el.formSubmissionDate.value = today;

  if (claim) {
    el.modalTitle.innerText = "Edit Claim Specifications";
    el.formClaimId.value = claim.id;
    el.formClaimNumber.value = claim.claimNumber || "";
    el.formServiceDate.value = claim.serviceDate ? claim.serviceDate.substring(0, 10) : "";
    el.formProvider.value = claim.provider || "";
    el.formSubmissionDate.value = claim.submissionDate ? claim.submissionDate.substring(0, 10) : "";
    el.formDescription.value = claim.description || "";
    el.formAmountSubmitted.value = claim.amountSubmitted || "";
    el.formStatus.value = claim.status || "Submitted";
    el.formComments.value = claim.comments || "";

    if (claim.status === "Approved" || claim.status === "Partially Approved") {
      el.approvalDetails.classList.remove("hidden");
      el.formAmountApproved.value = claim.amountApproved || "";
      el.formReimbursementDate.value = claim.reimbursementDate ? claim.reimbursementDate.substring(0, 10) : "";
    } else {
      el.approvalDetails.classList.add("hidden");
    }
  } else {
    el.modalTitle.innerText = "New Claim Entry";
    el.formClaimId.value = "";
    el.approvalDetails.classList.add("hidden");
  }

  el.claimModal.classList.add("active");
}

function closeClaimModal() {
  el.claimModal.classList.remove("active");
  state.editingClaimId = null;
}

function openDetailsModal(claim) {
  const statusClass = getStatusClass(claim.status);
  const statusLabel = getStatusLabel(claim.status);
  const submittedVal = parseFloat(claim.amountSubmitted || 0);
  const approvedVal = parseFloat(claim.amountApproved || 0);
  const outOfPocketVal = Math.max(0, submittedVal - approvedVal);
  const coveragePercent = submittedVal > 0 ? (approvedVal / submittedVal) * 100 : 0;

  el.detailProvider.innerText = claim.provider;
  el.detailDesc.innerText = claim.description || "No description provided.";

  // Status Badge reset
  el.detailStatus.className = `status-badge ${statusClass}`;
  el.detailStatus.innerText = statusLabel;

  el.detailNumber.innerText = claim.claimNumber || "N/A";
  el.detailServiceDate.innerText = formatDate(claim.serviceDate);
  el.detailSubmissionDate.innerText = formatDate(claim.submissionDate);
  el.detailReimbursementDate.innerText = formatDate(claim.reimbursementDate);

  el.detailAmountSubmitted.innerText = formatCurrency(submittedVal);

  // Set up financial views based on status
  if (claim.status === "Approved" || claim.status === "Partially Approved") {
    el.detailAmountApproved.innerText = formatCurrency(approvedVal);
    el.detailUncovered.innerText = formatCurrency(outOfPocketVal);
    el.detailCoverageBar.style.width = `${coveragePercent}%`;
    el.detailCoverageRatio.innerText = `${coveragePercent.toFixed(0)}% reimbursed`;
    document.getElementById("detail-coverage-bar-container").parentElement.classList.remove("hidden");
  } else {
    el.detailAmountApproved.innerText = formatCurrency(0);
    el.detailUncovered.innerText = formatCurrency(submittedVal);
    el.detailCoverageBar.style.width = "0%";
    el.detailCoverageRatio.innerText = "0% reimbursed";
    document.getElementById("detail-coverage-bar-container").parentElement.classList.add("hidden");
  }

  if (claim.comments) {
    el.detailCommentsContainer.classList.remove("hidden");
    el.detailComments.innerText = claim.comments;
  } else {
    el.detailCommentsContainer.classList.add("hidden");
  }

  // Attach buttons events for this specific claim
  el.detailEditBtn.onclick = () => {
    closeDetailsModal();
    openClaimModal(claim);
  };

  el.detailDeleteBtn.onclick = () => {
    if (confirm(`Are you sure you want to delete the claim for "${claim.provider}"?`)) {
      handleDeleteClaim(claim.id);
    }
  };

  el.detailsModal.classList.add("active");
}

function closeDetailsModal() {
  el.detailsModal.classList.remove("active");
}

// ================= CRUD SUBMISSIONS =================
async function handleFormSubmit(e) {
  e.preventDefault();

  const status = el.formStatus.value;
  const subAmount = parseFloat(el.formAmountSubmitted.value) || 0;

  // Validation: Approved portion cannot be larger than submitted portion
  let appAmount = 0;
  if (status === "Approved" || status === "Partially Approved") {
    appAmount = parseFloat(el.formAmountApproved.value) || 0;
    if (appAmount > subAmount) {
      alert("Approved amount cannot exceed the submitted invoice amount.");
      return;
    }
  } else if (status === "Approved") {
    appAmount = subAmount; // default to 100%
  }

  const claimData = {
    claimNumber: el.formClaimNumber.value,
    serviceDate: el.formServiceDate.value,
    provider: el.formProvider.value,
    submissionDate: el.formSubmissionDate.value,
    description: el.formDescription.value,
    amountSubmitted: subAmount,
    amountApproved: appAmount,
    status: status,
    reimbursementDate: el.formReimbursementDate.value || null,
    comments: el.formComments.value
  };

  el.saveClaimBtn.disabled = true;
  el.saveClaimBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

  try {
    const isEdit = !!state.editingClaimId;
    const url = isEdit
      ? `${CONFIG.API_BASE}/claims/${state.editingClaimId}`
      : `${CONFIG.API_BASE}/claims`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.token}`
      },
      body: JSON.stringify(claimData)
    });

    if (!res.ok) throw new Error("Could not save claim to database.");

    const saved = await res.json();

    if (isEdit) {
      state.claims = state.claims.map(c => c.id === saved.id ? saved : c);
    } else {
      state.claims.push(saved);
    }

    renderClaims();
    renderStats();
    closeClaimModal();
  } catch (err) {
    console.error("Save claim error:", err);
    alert(err.message);
  } finally {
    el.saveClaimBtn.disabled = false;
    el.saveClaimBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Claim`;
  }
}

async function handleDeleteClaim(id) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/claims/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error("Could not delete claim from database.");

    state.claims = state.claims.filter(c => c.id !== id);
    renderClaims();
    renderStats();
    closeDetailsModal();
  } catch (err) {
    console.error("Delete claim error:", err);
    alert(err.message);
  }
}

// ================= SEARCH & FILTERS =================
function handleSearch(e) {
  state.searchQuery = e.target.value;
  applyFilters();
}
