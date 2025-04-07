const API_URL = "http://localhost:5000/api";

// Utility: Get token from local storage
function getToken() {
  return localStorage.getItem("token");
}

// Utility: Format a Date object as dd-mm-yyyy
function formatDateDDMMYYYY(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// Generate an array of Date objects for the last 30 days (including today)
// Sorted in ascending order (oldest first, current date last)
function generateLast30Days() {
  const days = [];
  const today = new Date();
  // Start 29 days ago and go through today
  for (let i = 29; i >= 0; i--) {
    let day = new Date();
    day.setDate(today.getDate() - i);
    days.push(day);
  }
  return days;
}

// Login form submission
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("userId", data.id);
      showUserInterface(data.role, data.id, username);
      loadNotices();
    } else {
      document.getElementById("login-error").innerText = data.error || "Login failed";
    }
  } catch (error) {
    console.error("Error during login", error);
  }
});

// Show user interface after login
function showUserInterface(role, userId, username) {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("notice-section").style.display = "block";
  document.getElementById("nav-bar").style.display = "block";
  document.getElementById("user-info").innerText = `Logged in as: ${username} (${role})`;
  
  // Initially hide the add notice form.
  document.getElementById("add-notice-form").style.display = "none";
  
  // Show admin actions for admin
  if (role === "admin") {
    document.getElementById("admin-section").style.display = "block";
  }
}

// Logout function
function logout() {
  localStorage.clear();
  location.reload();
}

// Load notices from server
async function loadNotices() {
  try {
    const res = await fetch(`${API_URL}/notices`, {
      headers: {
        "Authorization": "Bearer " + getToken()
      }
    });
    const notices = await res.json();
    displayNotices(notices);
  } catch (error) {
    console.error("Error fetching notices", error);
  }
}

// Display notices grouped by date as horizontally scrolling tabs for the last 30 days.
function displayNotices(notices) {
  // Create a map: key = formatted date (dd-mm-yyyy), value = array of notices on that day.
  const noticeMap = {};
  notices.forEach(notice => {
    const noticeDate = new Date(notice.date);
    const formatted = formatDateDDMMYYYY(noticeDate);
    if (!noticeMap[formatted]) {
      noticeMap[formatted] = [];
    }
    noticeMap[formatted].push(notice);
  });
  
  // For each date in the last 30 days, sort the notices (if any) so that admin notices come first, then teacher notices.
  const days = generateLast30Days();
  days.forEach(day => {
    const key = formatDateDDMMYYYY(day);
    if (noticeMap[key]) {
      noticeMap[key].sort((a, b) => {
        if (a.poster_role === b.poster_role) {
          return new Date(b.date) - new Date(a.date);
        } else if (a.poster_role === "admin") {
          return -1;
        } else {
          return 1;
        }
      });
    } else {
      noticeMap[key] = []; // Ensure every date has an entry
    }
  });
  
  // Build horizontal tab navigation and content.
  const container = document.getElementById("notices-container");
  container.innerHTML = "";
  
  const tabNav = document.createElement("div");
  tabNav.className = "tab-nav";
  
  const tabContentContainer = document.createElement("div");
  tabContentContainer.className = "tab-content";
  
  // Create tabs in ascending order so that the last (rightmost) tab is the current date.
  days.forEach((day) => {
    const formatted = formatDateDDMMYYYY(day);
    const tabButton = document.createElement("button");
    tabButton.className = "tab-button";
    tabButton.innerText = formatted;
    tabButton.dataset.date = formatted;
    
    // Activate the current date's tab by default.
    const today = formatDateDDMMYYYY(new Date());
    if (formatted === today) {
      tabButton.classList.add("active");
      renderTabContent(formatted, noticeMap[formatted], tabContentContainer);
      // Show add notice form only if user is teacher or admin.
      if (localStorage.getItem("role") === "teacher" || localStorage.getItem("role") === "admin") {
        document.getElementById("add-notice-form").style.display = "block";
      } else {
        document.getElementById("add-notice-form").style.display = "none";
      }
    }
    
    tabButton.addEventListener("click", function() {
      document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
      tabButton.classList.add("active");
      renderTabContent(formatted, noticeMap[formatted], tabContentContainer);
      // Show add notice form only if this tab is today and user is teacher/admin.
      const today = formatDateDDMMYYYY(new Date());
      if (formatted === today && (localStorage.getItem("role") === "teacher" || localStorage.getItem("role") === "admin")) {
        document.getElementById("add-notice-form").style.display = "block";
      } else {
        document.getElementById("add-notice-form").style.display = "none";
      }
    });
    
    tabNav.appendChild(tabButton);
  });
  
  container.appendChild(tabNav);
  container.appendChild(tabContentContainer);
}

// Helper function to render notices for a specific date group.
function renderTabContent(date, noticesForDate, container) {
  container.innerHTML = "";
  if (!noticesForDate || noticesForDate.length === 0) {
    container.innerHTML = `<p>No notice</p>`;
    return;
  }
  noticesForDate.forEach(notice => {
    const noticeDiv = document.createElement("div");
    // Set class based on poster role for different background colors.
    if (notice.poster_role === "admin") {
      noticeDiv.className = "notice admin";
    } else {
      noticeDiv.className = "notice teacher";
    }
    noticeDiv.innerHTML = `<h3>${notice.title}</h3>
                           <p>${notice.content}</p>
                           <small>${new Date(notice.date).toLocaleString()}</small>
                           <p><em>Posted by: ${notice.poster_role === "admin" ? "Admin" : notice.poster_name}</em></p>`;
    
    // Show delete button if allowed.
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("userId");
    if (role === "admin" || (role === "teacher" && notice.teacher_id == userId)) {
      const delBtn = document.createElement("button");
      delBtn.innerText = "Delete Notice";
      delBtn.onclick = () => deleteNotice(notice.id);
      noticeDiv.appendChild(delBtn);
    }
    
    container.appendChild(noticeDiv);
  });
}

// Handle notice form submission for adding notice (only allowed on current day)
document.getElementById("notice-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const today = formatDateDDMMYYYY(new Date());
  const currentTab = document.querySelector(".tab-button.active").dataset.date;
  if (today !== currentTab) {
    alert("You can only add a notice on the current day.");
    return;
  }
  
  const title = document.getElementById("notice-title").value;
  const content = document.getElementById("notice-content").value;
  
  try {
    const res = await fetch(`${API_URL}/notices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      },
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadNotices();
  } catch (error) {
    console.error("Error adding notice", error);
  }
});

// Delete a notice
async function deleteNotice(noticeId) {
  try {
    const res = await fetch(`${API_URL}/notices/${noticeId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      }
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadNotices();
  } catch (error) {
    console.error("Error deleting notice", error);
  }
}

// Admin: Add new user
document.getElementById("user-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("new-username").value;
  const password = document.getElementById("new-password").value;
  const role = document.getElementById("new-role").value;
  
  try {
    const res = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
      },
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    alert(data.message || data.error);
  } catch (error) {
    console.error("Error adding user", error);
  }
});

// Admin: Delete old notices
async function deleteOldNotices() {
  try {
    const res = await fetch(`${API_URL}/notices/old`, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + getToken()
      }
    });
    const data = await res.json();
    alert(data.message || data.error);
    loadNotices();
  } catch (error) {
    console.error("Error deleting old notices", error);
  }
}
