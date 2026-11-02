/* =========================================================
   VIDYA LIBRARY | THE STUDY ZONE
   Complete JavaScript
   Firebase + Google Login + Seats + Lockers
   Books + Booking History + UPI Payment
   ========================================================= */

"use strict";

/* ================= FIREBASE IMPORTS ================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    push,
    update,
    onValue,
    query,
    orderByChild,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";


/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
    apiKey: "AIzaSyAinNLUTaMDRYhAHId_3c-44nN2ygGAF_c",
    authDomain: "vidya-library-7aeb7.firebaseapp.com",
    databaseURL: "https://vidya-library-7aeb7-default-rtdb.firebaseio.com",
    projectId: "vidya-library-7aeb7",
    storageBucket: "vidya-library-7aeb7.firebasestorage.app",
    messagingSenderId: "213812561204",
    appId: "1:213812561204:web:7cec5ec006e1a419f51161"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: "select_account"
});


/* ================= LIBRARY SETTINGS ================= */

const TOTAL_SEATS = 80;

const TOTAL_LOCKERS = 24;

const DEPOSIT = 300;

const LOCKER_MONTHLY = 100;

const UPI_ID = "q270033628@ybl";

const PAYEE_NAME = "Vidyalibrary the study zone";


/* ================= FEES ================= */

const FEES = {

    "4": {
        "1": 500,
        "2": 800,
        "3": 1200,
        "6": 2400
    },

    "6": {
        "1": 700,
        "2": 1200,
        "3": 1800,
        "6": 3200
    },

    "8": {
        "1": 900,
        "2": 1600,
        "3": 2200,
        "6": 4000
    },

    "Full Time": {
        "1": 1000,
        "2": 1800,
        "3": 2500,
        "6": 4500
    },

    "Reserved": {
        "1": 1200,
        "2": 2200,
        "3": 3200,
        "6": 5500
    }

};


/* ================= GLOBAL VARIABLES ================= */

let currentUser = null;

let selectedSeat = null;

let selectedLocker = null;

let availability = {
    seats: {},
    lockers: {}
};

let availabilityReady = false;

let bookingsReady = false;

let myBookings = [];

let myBookingListenerStop = null;

let currentBookingDraft = null;

let currentLockerDraft = null;

let booksCache = [];

let toastTimer = null;


/* ================= HELPER FUNCTIONS ================= */

const $ = id => document.getElementById(id);


function value(id, fallback = "") {

    return $(id)?.value ?? fallback;

}


function text(id, content) {

    const element = $(id);

    if (element) {
        element.textContent = content;
    }

}


function money(amount) {

    return "₹" + Number(amount || 0).toLocaleString("en-IN");

}


function escapeHTML(input) {

    return String(input ?? "").replace(/[&<>"']/g, character => ({

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"

    })[character]);

}


function normalisePhone(phone) {

    return String(phone || "")
        .replace(/\D/g, "")
        .slice(-10);

}


function todayDate() {

    const date = new Date();

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


/* ================= TOAST MESSAGE ================= */

function toast(message, type = "info") {

    let node = $("toast");

    if (!node) {

        node = document.createElement("div");

        node.id = "toast";

        document.body.appendChild(node);

    }

    node.textContent = message;

    node.style.display = "block";

    node.style.position = "fixed";

    node.style.left = "50%";

    node.style.bottom = "85px";

    node.style.transform = "translateX(-50%)";

    node.style.zIndex = "99999";

    node.style.maxWidth = "90%";

    node.style.padding = "12px 18px";

    node.style.borderRadius = "12px";

    node.style.color = "#ffffff";

    node.style.background =
        type === "error" ? "#b42318" : "#252f87";

    node.style.boxShadow = "0 5px 20px #0003";

    node.style.textAlign = "center";

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        node.style.display = "none";

    }, 3500);

}


/* ================= PAGE NAVIGATION ================= */

function go(page) {

    const target = $(page);

    if (!target) {

        toast("यह पेज नहीं मिला।", "error");

        return;
    }

    document.querySelectorAll(".page").forEach(section => {

        section.classList.remove("active");

    });

    target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

window.go = go;


/* ================= AUTH MODE ================= */

function setAuthMode(mode) {

    const loginTab = $("loginTab");

    const registerTab = $("registerTab");

    if (loginTab) {

        loginTab.classList.toggle(
            "btn-primary",
            mode === "login"
        );

        loginTab.classList.toggle(
            "btn-outline",
            mode !== "login"
        );

    }

    if (registerTab) {

        registerTab.classList.toggle(
            "btn-primary",
            mode === "register"
        );

        registerTab.classList.toggle(
            "btn-outline",
            mode !== "register"
        );

    }

    toast(
        "अभी Google Login से अकाउंट बनाया या खोला जा सकता है।"
    );

}

window.setAuthMode = setAuthMode;


/* ================= SELECTED VALUES ================= */

function selectedPlan() {

    return value("slot", "4");

}


function selectedMonths() {

    return String(value("months", "1"));

}


function selectedStartDate() {

    return value("startDate", todayDate());

}


/* ================= DEPOSIT CHECK ================= */

function hasPaidDepositBefore() {

    return myBookings.some(booking =>

        booking.status === "confirmed" &&
        booking.depositPaid === true &&
        booking.bookingType !== "locker"

    );

}


function getDepositAmount() {

    if (!bookingsReady) {

        return DEPOSIT;

    }

    return hasPaidDepositBefore() ? 0 : DEPOSIT;

}


/* ================= AVAILABILITY STATUS ================= */

function getSeatStatus(seatNo) {

    const item = availability.seats?.[String(seatNo)];

    if (!item) {
        return "available";
    }

    if (typeof item === "string") {
        return item;
    }

    return item.status || "available";

}


function getLockerStatus(lockerNo) {

    const item = availability.lockers?.[String(lockerNo)];

    if (!item) {
        return "available";
    }

    if (typeof item === "string") {
        return item;
    }

    return item.status || "available";

}


function isUnavailable(status) {

    return [

        "pending",
        "pending_hold",
        "pending_verification",
        "confirmed",
        "booked",
        "occupied"

    ].includes(String(status).toLowerCase());

}


/* ================= GOOGLE LOGIN ================= */

async function loginGoogle() {

    try {

        await signInWithPopup(
            auth,
            googleProvider
        );

        toast("Google Login सफल हुआ।");

    } catch (error) {

        console.warn("Google Login:", error);

        if (

            error.code === "auth/popup-blocked" ||

            error.code === "auth/operation-not-supported-in-this-environment"

        ) {

            try {

                await signInWithRedirect(
                    auth,
                    googleProvider
                );

            } catch (redirectError) {

                toast(
                    authErrorMessage(redirectError),
                    "error"
                );

            }

        } else {

            toast(
                authErrorMessage(error),
                "error"
            );

        }

    }

}


async function logout() {

    try {

        await signOut(auth);

        toast("आप Logout हो गए हैं।");

        go("home");

    } catch (error) {

        toast(
            "Logout नहीं हुआ: " + error.message,
            "error"
        );

    }

}


function authErrorMessage(error) {

    const messages = {

        "auth/unauthorized-domain":
            "Firebase Console में वेबसाइट का Domain जोड़ें।",

        "auth/popup-closed-by-user":
            "Login बीच में बंद कर दिया गया।",

        "auth/network-request-failed":
            "Internet Connection जाँचें।",

        "auth/operation-not-allowed":
            "Firebase Console में Google Sign-in Enable करें।",

        "auth/invalid-api-key":
            "Firebase API Key सही नहीं है।"

    };

    return messages[error.code] ||
        error.message ||
        "Login में समस्या आई।";

}


/* ================= LOGIN UI ================= */

function setupLoginUI() {

    const form = $("authForm");

    if (!form) {
        return;
    }

    form.innerHTML = `

        <div class="google-login-box">

            <p id="authStatus">
                Google Account से Login करें
            </p>

            <button
                type="button"
                id="googleLoginBtn"
                class="btn btn-primary full">

                Google से Login करें

            </button>

            <button
                type="button"
                id="googleLogoutBtn"
                class="btn btn-outline full"
                style="display:none;margin-top:10px">

                Logout

            </button>

        </div>

    `;

    $("googleLoginBtn")?.addEventListener(
        "click",
        loginGoogle
    );

    $("googleLogoutBtn")?.addEventListener(
        "click",
        logout
    );

}


/* ================= UPDATE AUTH UI ================= */

function updateAuthUI(user) {

    const status = $("authStatus");

    const loginBtn = $("googleLoginBtn");

    const logoutBtn = $("googleLogoutBtn");

    if (status) {

        status.textContent = user

            ? `Login: ${user.displayName || user.email || "Student"}`

            : "Google Account से Login करें";

    }

    if (loginBtn) {

        loginBtn.style.display =
            user ? "none" : "block";

    }

    if (logoutBtn) {

        logoutBtn.style.display =
            user ? "block" : "none";

    }

    if (user) {

        if ($("studentName") && !$("studentName").value) {

            $("studentName").value =
                user.displayName || "";

        }

        if ($("lockerStudentName") && !$("lockerStudentName").value) {

            $("lockerStudentName").value =
                user.displayName || "";

        }

    }

    text(
        "profileName",
        user?.displayName || "अतिथि विद्यार्थी"
    );

    text(
        "profilePhone",
        user?.phoneNumber || user?.email || "अभी लॉगिन नहीं किया"
    );

    text(
        "profileStatus",
        user ? "Logged in" : "Login आवश्यक है"
    );

    const avatar = $("profileAvatar");

    if (avatar) {

        avatar.textContent =
            (user?.displayName || "वि").charAt(0).toUpperCase();

    }

}


/* ================= LIVE AVAILABILITY ================= */

function startAvailabilityListener() {

    onValue(

        ref(db, "public/availability"),

        snapshot => {

            const data = snapshot.val() || {};

            availability = {

                seats: data.seats || {},

                lockers: data.lockers || {}

            };

            availabilityReady = true;

            renderSeatGrid();

            renderLockerGrid();

            updateSummary();

        },

        error => {

            console.error("Availability:", error);

            availabilityReady = false;

            toast(
                "Availability लोड नहीं हुई। Firebase Rules जाँचें।",
                "error"
            );

        }

    );

}


/* ================= SEAT GRID ================= */

function renderSeatGrid() {

    const grid = $("seatGrid");

    if (!grid) {
        return;
    }

    const reservedPlan =
        selectedPlan() === "Reserved";

    grid.innerHTML = "";

    grid.style.display =
        reservedPlan ? "grid" : "none";

    if (!reservedPlan) {

        selectedSeat = null;

        text(
            "seatMessage",
            "इस Plan में सीट Library/Admin द्वारा दी जाएगी।"
        );

        return;
    }

    if (!availabilityReady) {

        text(
            "seatMessage",
            "सीट की उपलब्धता लोड हो रही है..."
        );

        return;
    }

    let freeSeats = 0;

    for (
        let seat = 1;
        seat <= TOTAL_SEATS;
        seat++
    ) {

        const status = getSeatStatus(seat);

        const unavailable = isUnavailable(status);

        if (!unavailable) {
            freeSeats++;
        }

        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "seat " +
            (unavailable ? "booked" : "available") +
            (selectedSeat === seat ? " selected" : "");

        button.textContent = seat;

        button.disabled = unavailable;

        if (!unavailable) {

            button.addEventListener("click", () => {

                selectedSeat = seat;

                renderSeatGrid();

                updateSummary();

            });

        }

        grid.appendChild(button);

    }

    text(
        "seatMessage",
        `${freeSeats} सीट उपलब्ध हैं। Reserved Plan के लिए एक सीट चुनें।`
    );

}


/* ================= LOCKER GRID ================= */

function renderLockerGrid() {

    const grid = $("lockerGrid");

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    for (
        let locker = 1;
        locker <= TOTAL_LOCKERS;
        locker++
    ) {

        const status = getLockerStatus(locker);

        const unavailable = isUnavailable(status);

        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "locker " +
            (unavailable ? "booked" : "available") +
            (selectedLocker === locker ? " selected" : "");

        button.textContent = `L${locker}`;

        button.disabled = unavailable;

        if (!unavailable) {

            button.addEventListener("click", () => {

                selectedLocker = locker;

                text(
                    "lockerChoice",
                    `L${locker}`
                );

                renderLockerGrid();

                updateSummary();

            });

        }

        grid.appendChild(button);

    }

    if (!selectedLocker) {

        text(
            "lockerChoice",
            "कोई नहीं"
        );

    }

}


/* ================= FEE CALCULATION ================= */

function calculateBookingAmount() {

    const plan = selectedPlan();

    const months = selectedMonths();

    const baseFee =
        FEES[plan]?.[months] ?? 0;

    const lockerFee = selectedLocker

        ? LOCKER_MONTHLY * Number(months)

        : 0;

    const deposit = getDepositAmount();

    return {

        baseFee,

        lockerFee,

        deposit,

        total: baseFee + lockerFee + deposit,

        months: Number(months),

        plan

    };

}


/* ================= UPDATE SUMMARY ================= */

function updateSummary() {

    const amount = calculateBookingAmount();

    text(
        "sumSeat",

        selectedPlan() === "Reserved"

            ? (
                selectedSeat
                    ? `Seat ${selectedSeat}`
                    : "सीट चुनें"
            )

            : "Library द्वारा आवंटित"
    );

    text("sumSlot", amount.plan);

    text(
        "sumMonths",
        `${amount.months} महीने`
    );

    text("sumFee", money(amount.baseFee));

    text("sumLocker", money(amount.lockerFee));

    text("sumDeposit", money(amount.deposit));

    text("sumTotal", money(amount.total));

    const lockerPrice = $("lockerPrice");

    if (lockerPrice) {

        lockerPrice.textContent = money(

            LOCKER_MONTHLY *
            Number(value("lockerMonths", "1"))

        );

    }

}


/* ================= STUDENT DETAILS ================= */

function getStudentDetails() {

    if (!currentUser) {

        toast(
            "Booking करने से पहले Google Login करें।",
            "error"
        );

        return null;

    }

    if (!bookingsReady) {

        toast(
            "आपकी Booking History लोड हो रही है। थोड़ी देर बाद प्रयास करें।",
            "error"
        );

        return null;

    }

    const name = String(

        value("studentName") ||
        currentUser.displayName ||
        ""

    ).trim();

    const phone = normalisePhone(
        value("studentPhone")
    );

    const startDate = selectedStartDate();

    const plan = selectedPlan();

    const months = Number(selectedMonths());

    if (name.length < 2) {

        toast(
            "कृपया विद्यार्थी का पूरा नाम भरें।",
            "error"
        );

        return null;

    }

    if (!/^[6-9]\d{9}$/.test(phone)) {

        toast(
            "सही 10 अंकों का मोबाइल नंबर भरें।",
            "error"
        );

        return null;

    }

    if (!FEES[plan] || !FEES[plan][String(months)]) {

        toast(
            "सही Plan और अवधि चुनें।",
            "error"
        );

        return null;

    }

    if (!startDate) {

        toast(
            "Booking की Start Date चुनें।",
            "error"
        );

        return null;

    }

    if (startDate < todayDate()) {

        toast(
            "पुरानी तारीख चुन नहीं सकते।",
            "error"
        );

        return null;

    }

    if (
        plan === "Reserved" &&
        !selectedSeat
    ) {

        toast(
            "Reserved Plan के लिए पहले उपलब्ध सीट चुनें।",
            "error"
        );

        return null;

    }

    if (plan !== "Reserved") {

        selectedSeat = null;

    }

    return {

        name,

        phone,

        startDate,

        plan,

        months

    };

}


/* ================= PAYMENT AREA ================= */

function getPaymentArea(parentId) {

    let area = $("paymentArea");

    if (!area) {

        area = document.createElement("div");

        area.id = "paymentArea";

        area.className = "card";

    }

    const parent = $(parentId);

    if (parent && area.parentElement !== parent) {

        parent.appendChild(area);

    }

    area.hidden = false;

    area.style.display = "block";

    return area;

}


/* ================= PREPARE BOOKING ================= */

function prepareBooking() {

    const student = getStudentDetails();

    if (!student) {
        return;
    }

    const amount = calculateBookingAmount();

    currentBookingDraft = {

        ...student,

        seatPreference:
            student.plan === "Reserved"
                ? selectedSeat
                : null,

        seatAssignment:
            student.plan === "Reserved"
                ? "student_requested"
                : "admin_to_assign",

        ...amount

    };

    showPaymentPanel(currentBookingDraft);

}


/* ================= SHOW PAYMENT PANEL ================= */

function showPaymentPanel(draft) {

    const paymentArea = getPaymentArea("fees");

    const method = value("payMethod", "UPI");

    const utrInput = method === "UPI"

        ? `

            <label for="paymentUtr">
                UTR / UPI Reference Number
            </label>

            <input
                id="paymentUtr"
                type="text"
                maxlength="30"
                placeholder="Payment करने के बाद UTR भरें"
                style="width:100%;padding:12px;margin:8px 0">

        `

        : `

            <p>
                नकद भुगतान Library Counter पर किया जाएगा।
            </p>

        `;

    paymentArea.innerHTML = `

        <div class="payment-card">

            <h3>PhonePe / Google Pay Payment</h3>

            <p>
                विद्यार्थी:
                <b>${escapeHTML(draft.name)}</b>
            </p>

            <p>
                Plan:
                <b>${escapeHTML(draft.plan)}</b>
                · अवधि: ${draft.months} महीने
            </p>

            <p>
                सीट:
                <b>
                    ${
                        draft.plan === "Reserved"
                            ? "Seat " + draft.seatPreference
                            : "Library/Admin आवंटित करेगा"
                    }
                </b>
            </p>

            <p>लॉकर फीस: ${money(draft.lockerFee)}</p>

            <p>डिपॉजिट: ${money(draft.deposit)}</p>

            <h2 style="color:#252f87">
                ${money(draft.total)}
            </h2>

            ${
                method === "UPI"

                ? `

                    <p>
                        UPI ID:
                        <b>${UPI_ID}</b>
                    </p>

                    <p>
                        Payee: ${PAYEE_NAME}
                    </p>

                    <button
                        type="button"
                        id="openUPIBtn"
                        class="btn btn-primary full">

                        Google Pay / PhonePe खोलें

                    </button>

                `

                : ""

            }

            ${utrInput}

            <button
                type="button"
                id="submitBookingBtn"
                class="btn btn-primary full">

                Booking Request जमा करें

            </button>

            <small style="display:block;margin-top:12px;line-height:1.6">

                जरूरी: UTR जमा करने से Payment Verified नहीं होता।
                Library आपके Bank/UPI रिकॉर्ड में Payment जाँचकर ही
                Booking Confirm करेगी।

            </small>

        </div>

    `;

    $("openUPIBtn")?.addEventListener(
        "click",
        () => openUPI(draft.total)
    );

    $("submitBookingBtn")?.addEventListener(
        "click",
        submitBooking
    );

    paymentArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* ================= OPEN UPI ================= */

function openUPI(amount) {

    const params = new URLSearchParams({

        pa: UPI_ID,

        pn: PAYEE_NAME,

        am: Number(amount).toFixed(2),

        cu: "INR",

        tn: "Vidya Library Booking"

    });

    const upiUrl =
        `upi://pay?${params.toString()}`;

    window.location.href = upiUrl;

}


/* ================= SUBMIT BOOKING ================= */

async function submitBooking() {

    if (!currentUser || !currentBookingDraft) {

        toast(
            "पहले Login करके Booking तैयार करें।",
            "error"
        );

        return;

    }

    const draft = currentBookingDraft;

    const method = value("payMethod", "UPI");

    let utr = "";

    if (method === "UPI") {

        utr = String(
            value("paymentUtr")
        ).trim().replace(/\s+/g, "");

        if (!/^[A-Za-z0-9]{8,30}$/.test(utr)) {

            toast(
                "सही UTR / UPI Reference Number भरें।",
                "error"
            );

            return;

        }

    }

    const bookingRef = push(
        ref(db, "bookingRequests")
    );

    const bookingId = bookingRef.key;

    const record = {

        bookingId,

        uid: currentUser.uid,

        studentName: draft.name,

        studentPhone: draft.phone,

        email: currentUser.email || "",

        plan: draft.plan,

        months: draft.months,

        startDate: draft.startDate,

        baseFee: draft.baseFee,

        lockerFee: draft.lockerFee,

        refundableDeposit: draft.deposit,

        totalAmount: draft.total,

        bookingType: "seat",

        requestedSeat:
            draft.plan === "Reserved"
                ? draft.seatPreference
                : null,

        seatAssignment: draft.seatAssignment,

        locker: null,

        paymentMethod: method,

        upiId: method === "UPI" ? UPI_ID : "",

        utr,

        paymentStatus:
            method === "UPI"
                ? "submitted_for_verification"
                : "cash_due",

        status:
            method === "UPI"
                ? "pending_verification"
                : "pending_payment",

        depositPaid: false,

        createdAt: serverTimestamp()

    };

    const updates = {};

    updates[
        `users/${currentUser.uid}/bookings/${bookingId}`
    ] = record;

    updates[
        `bookingRequests/${bookingId}`
    ] = record;

    try {

        await update(ref(db), updates);

        toast(
            "Booking Request जमा हो गई। Admin Verification का इंतजार करें।"
        );

        currentBookingDraft = null;

        const area = $("paymentArea");

        if (area) {

            area.innerHTML = `

                <h3>Booking Request जमा हो गई</h3>

                <p>
                    Booking ID:
                    <b>${escapeHTML(bookingId)}</b>
                </p>

                <p>
                    आपकी Booking अभी Verification Pending है।
                    Admin द्वारा पुष्टि होने के बाद ही Confirm होगी।
                </p>

            `;

        }

    } catch (error) {

        console.error("Booking Error:", error);

        toast(
            "Booking जमा नहीं हुई: " + error.message,
            "error"
        );

    }

}


/* ================= LOCKER BOOKING ================= */

async function saveLocker() {

    if (!currentUser) {

        toast(
            "Locker लेने से पहले Google Login करें।",
            "error"
        );

        return;

    }

    const name = String(

        value("lockerStudentName") ||
        currentUser.displayName ||
        ""

    ).trim();

    const phone = normalisePhone(
        value("lockerStudentPhone")
    );

    const lockerMonths =
        Number(value("lockerMonths", "1"));

    const startDate =
        value("lockerStartDate", todayDate());

    const locker = Number(selectedLocker || 0);

    if (name.length < 2) {

        toast(
            "कृपया पूरा नाम भरें।",
            "error"
        );

        return;

    }

    if (!/^[6-9]\d{9}$/.test(phone)) {

        toast(
            "सही 10 अंकों का मोबाइल नंबर भरें।",
            "error"
        );

        return;

    }

    if (
        !locker ||
        locker < 1 ||
        locker > TOTAL_LOCKERS
    ) {

        toast(
            "कृपया उपलब्ध Locker चुनें।",
            "error"
        );

        return;

    }

    if (isUnavailable(getLockerStatus(locker))) {

        toast(
            "यह Locker अभी उपलब्ध नहीं है। दूसरा चुनें।",
            "error"
        );

        return;

    }

    if (![1, 2, 3, 6].includes(lockerMonths)) {

        toast(
            "Locker की अवधि चुनें।",
            "error"
        );

        return;

    }

    if (startDate < todayDate()) {

        toast(
            "पुरानी तारीख चुन नहीं सकते।",
            "error"
        );

        return;

    }

    const total = LOCKER_MONTHLY * lockerMonths;

    currentLockerDraft = {

        name,

        phone,

        locker,

        months: lockerMonths,

        startDate,

        total

    };

    showLockerPayment(currentLockerDraft);

}


/* ================= LOCKER PAYMENT PANEL ================= */

function showLockerPayment(draft) {

    const paymentArea = getPaymentArea("lockers");

    paymentArea.innerHTML = `

        <div class="payment-card">

            <h3>Locker Payment</h3>

            <p>
                विद्यार्थी:
                <b>${escapeHTML(draft.name)}</b>
            </p>

            <p>
                Locker:
                <b>L${draft.locker}</b>
            </p>

            <p>
                अवधि:
                ${draft.months} महीने
            </p>

            <h2>${money(draft.total)}</h2>

            <p>
                UPI ID:
                <b>${UPI_ID}</b>
            </p>

            <button
                type="button"
                id="openPhonePeLocker"
                class="btn btn-primary full">

                Google Pay / PhonePe खोलें

            </button>

            <label
                for="lockerUTR"
                style="display:block;margin-top:12px">

                UTR / UPI Reference Number

            </label>

            <input
                id="lockerUTR"
                type="text"
                maxlength="30"
                placeholder="Payment करने के बाद UTR भरें"
                style="width:100%;padding:12px;margin:8px 0">

            <button
                type="button"
                id="submitLockerUTR"
                class="btn btn-primary full">

                Locker Request जमा करें

            </button>

            <small>
                Locker Payment Admin द्वारा Verify होने के बाद ही Confirm होगा।
            </small>

        </div>

    `;

    $("openPhonePeLocker")?.addEventListener(
        "click",
        () => openUPI(draft.total)
    );

    $("submitLockerUTR")?.addEventListener(
        "click",
        submitLockerWithUTR
    );

    paymentArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* ================= SUBMIT LOCKER REQUEST ================= */

async function submitLockerWithUTR() {

    if (!currentUser || !currentLockerDraft) {

        toast(
            "पहले Login करें और Locker चुनें।",
            "error"
        );

        return;

    }

    const utr = String(
        value("lockerUTR")
    ).trim().replace(/\s+/g, "");

    if (!/^[A-Za-z0-9]{8,30}$/.test(utr)) {

        toast(
            "सही UTR भरें।",
            "error"
        );

        return;

    }

    const draft = currentLockerDraft;

    const bookingRef = push(
        ref(db, "bookingRequests")
    );

    const bookingId = bookingRef.key;

    const record = {

        bookingId,

        uid: currentUser.uid,

        studentName: draft.name,

        studentPhone: draft.phone,

        email: currentUser.email || "",

        bookingType: "locker",

        locker: draft.locker,

        months: draft.months,

        startDate: draft.startDate,

        lockerFee: draft.total,

        totalAmount: draft.total,

        paymentMethod: "UPI",

        upiId: UPI_ID,

        utr,

        paymentStatus:
            "submitted_for_verification",

        status:
            "pending_verification",

        createdAt: serverTimestamp()

    };

    const updates = {};

    updates[
        `users/${currentUser.uid}/bookings/${bookingId}`
    ] = record;

    updates[
        `bookingRequests/${bookingId}`
    ] = record;

    try {

        await update(ref(db), updates);

        currentLockerDraft = null;

        toast(
            "Locker Request Verification के लिए भेज दी गई।"
        );

        const area = $("paymentArea");

        if (area) {

            area.innerHTML = `

                <h3>Locker Request जमा हो गई</h3>

                <p>
                    Booking ID:
                    <b>${escapeHTML(bookingId)}</b>
                </p>

                <p>
                    Admin Verification के बाद ही Locker Confirm होगा।
                </p>

            `;

        }

    } catch (error) {

        console.error("Locker Error:", error);

        toast(
            "Locker Request जमा नहीं हुई: " + error.message,
            "error"
        );

    }

}


/* ================= MY BOOKING HISTORY ================= */

function startMyBookingsListener(user) {

    if (myBookingListenerStop) {

        myBookingListenerStop();

        myBookingListenerStop = null;

    }

    bookingsReady = false;

    myBookings = [];

    const bookingsQuery = query(

        ref(db, `users/${user.uid}/bookings`),

        orderByChild("createdAt")

    );

    myBookingListenerStop = onValue(

        bookingsQuery,

        snapshot => {

            const data = snapshot.val() || {};

            myBookings = Object.entries(data)

                .map(([id, booking]) => ({

                    bookingId: id,

                    ...booking

                }))

                .sort((a, b) => {

                    const at =
                        Number(a.createdAt || 0);

                    const bt =
                        Number(b.createdAt || 0);

                    return bt - at;

                });

            bookingsReady = true;

            renderHistory();

            updateSummary();

        },

        error => {

            console.error("History Error:", error);

            bookingsReady = false;

            toast(
                "Booking History लोड नहीं हुई। Firebase Rules जाँचें।",
                "error"
            );

        }

    );

}


/* ================= STATUS LABEL ================= */

function statusLabel(status) {

    const map = {

        pending: "Pending",

        pending_verification:
            "Payment Verification Pending",

        pending_payment:
            "Payment Pending",

        confirmed:
            "Confirmed",

        rejected:
            "Rejected",

        cancelled:
            "Cancelled"

    };

    return map[status] || status || "Pending";

}


/* ================= SHOW BOOKING HISTORY ================= */

function renderHistory() {

    const list = $("historyList");

    if (!list) {
        return;
    }

    if (!currentUser) {

        list.innerHTML =
            "<p>History देखने के लिए Google Login करें।</p>";

        return;

    }

    if (!myBookings.length) {

        list.innerHTML =
            "<p>अभी कोई Booking History नहीं है।</p>";

        return;

    }

    list.innerHTML = myBookings.map(booking => `

        <article class="history-item"
            style="padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:12px">

            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">

                <b>
                    ${
                        booking.bookingType === "locker"

                            ? `Locker L${booking.locker || ""}`

                            : booking.plan || "Seat Booking"
                    }
                </b>

                <span>
                    ${escapeHTML(statusLabel(booking.status))}
                </span>

            </div>

            <p>
                Booking ID:
                ${escapeHTML(booking.bookingId || "")}
            </p>

            <p>
                Seat:

                ${
                    booking.bookingType === "locker"

                        ? "—"

                        : booking.assignedSeat

                            ? `Seat ${escapeHTML(booking.assignedSeat)}`

                            : booking.requestedSeat

                                ? `Requested Seat ${escapeHTML(booking.requestedSeat)}`

                                : "Admin आवंटित करेगा"
                }

            </p>

            <p>
                राशि:
                ${money(booking.totalAmount)}
            </p>

            <p>
                Payment:
                ${escapeHTML(booking.paymentStatus || "Not updated")}
            </p>

            ${
                booking.status === "confirmed"

                    ? `

                        <button
                            type="button"
                            class="receipt-btn"
                            data-id="${escapeHTML(booking.bookingId)}">

                            Receipt / Print

                        </button>

                    `

                    : ""
            }

        </article>

    `).join("");

    list.querySelectorAll(".receipt-btn").forEach(button => {

        button.addEventListener("click", () => {

            printReceipt(button.dataset.id);

        });

    });

}


/* ================= PRINT RECEIPT ================= */

function printReceipt(id) {

    const booking = myBookings.find(
        item => item.bookingId === id
    );

    if (!booking || booking.status !== "confirmed") {

        toast(
            "Receipt केवल Confirmed Booking के लिए उपलब्ध है।",
            "error"
        );

        return;

    }

    const receipt = `

        <!DOCTYPE html>

        <html lang="hi">

        <head>

            <meta charset="UTF-8">

            <meta name="viewport"
                content="width=device-width,initial-scale=1">

            <title>Vidya Library Receipt</title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    padding: 24px;
                    color: #222;
                }

                .receipt {
                    max-width: 650px;
                    margin: auto;
                    border: 2px solid #252f87;
                    padding: 24px;
                    border-radius: 12px;
                }

                h1 {
                    color: #252f87;
                    margin: 0 0 4px;
                }

                .sub {
                    color: #df2028;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                td {
                    padding: 10px;
                    border-bottom: 1px solid #ddd;
                }

                td:first-child {
                    font-weight: bold;
                    width: 42%;
                }

                .total {
                    font-size: 22px;
                    color: #252f87;
                    font-weight: bold;
                }

                @media print {
                    button {
                        display: none;
                    }
                }

            </style>

        </head>

        <body>

            <div class="receipt">

                <h1>VIDYA LIBRARY</h1>

                <div class="sub">
                    THE STUDY ZONE · RAJNANDGAON
                </div>

                <h2>Booking Receipt</h2>

                <table>

                    <tr>
                        <td>Booking ID</td>
                        <td>${escapeHTML(booking.bookingId)}</td>
                    </tr>

                    <tr>
                        <td>Student</td>
                        <td>${escapeHTML(booking.studentName || currentUser?.displayName || "")}</td>
                    </tr>

                    <tr>
                        <td>Mobile</td>
                        <td>${escapeHTML(booking.studentPhone || "")}</td>
                    </tr>

                    <tr>
                        <td>Plan</td>
                        <td>${escapeHTML(booking.plan || "Locker")}</td>
                    </tr>

                    <tr>
                        <td>Seat</td>
                        <td>
                            ${
                                booking.assignedSeat

                                    ? "Seat " + escapeHTML(booking.assignedSeat)

                                    : booking.requestedSeat

                                        ? "Seat " + escapeHTML(booking.requestedSeat)

                                        : "—"
                            }
                        </td>
                    </tr>

                    <tr>
                        <td>Locker</td>
                        <td>
                            ${booking.locker ? "L" + escapeHTML(booking.locker) : "—"}
                        </td>
                    </tr>

                    <tr>
                        <td>Start Date</td>
                        <td>${escapeHTML(booking.startDate || "")}</td>
                    </tr>

                    <tr>
                        <td>Duration</td>
                        <td>${escapeHTML(booking.months || "")} months</td>
                    </tr>

                    <tr>
                        <td>Payment Status</td>
                        <td>Paid / Verified</td>
                    </tr>

                    <tr>
                        <td>Total Paid</td>
                        <td class="total">
                            ${money(booking.totalAmount)}
                        </td>
                    </tr>

                </table>

                <p>
                    Thank you for choosing Vidya Library.
                </p>

                <button onclick="window.print()">
                    Print / Save as PDF
                </button>

            </div>

        </body>

        </html>

    `;

    const win = window.open("", "_blank");

    if (!win) {

        toast(
            "Receipt खोलने के लिए Browser में Pop-ups Allow करें।",
            "error"
        );

        return;

    }

    win.document.open();

    win.document.write(receipt);

    win.document.close();

}


/* ================= BOOKS DATABASE ================= */

function startBooksListener() {

    onValue(

        ref(db, "books"),

        snapshot => {

            const data = snapshot.val() || {};

            booksCache = Object.entries(data).map(
                ([id, book]) => ({
                    id,
                    ...book
                })
            );

            renderBooks(booksCache);

            text(
                "totalBooks",
                booksCache.length
            );

            text(
                "totalCopies",

                booksCache.reduce(
                    (sum, book) =>
                        sum + Number(book.copies || 0),
                    0
                )
            );

            text(
                "bookResults",
                `कुल ${booksCache.length} किताबें मिलीं।`
            );

        },

        error => {

            console.warn("Books listener:", error);

            text(
                "bookResults",
                "Books Database लोड नहीं हुआ।"
            );

        }

    );

}


/* ================= RENDER BOOKS ================= */

function renderBooks(books) {

    const grid = $("booksGrid");

    if (!grid) {
        return;
    }

    if (!books.length) {

        grid.innerHTML =
            "<p>अभी Books की जानकारी उपलब्ध नहीं है।</p>";

        return;

    }

    grid.innerHTML = books.map(book => `

        <article class="book-card"
            style="padding:12px;border:1px solid #ddd;border-radius:12px;margin:8px 0">

            <b>
                ${escapeHTML(book.title || "Untitled Book")}
            </b>

            <p>
                ${escapeHTML(book.author || "")}
            </p>

            <small>
                Copies: ${Number(book.copies || 0)}
                ·
                ${escapeHTML(book.category || "")}
            </small>

        </article>

    `).join("");

}


/* ================= SEARCH BOOKS ================= */

function searchBooks() {

    const term = String(
        value("bookSearch")
    ).trim().toLowerCase();

    const filtered = booksCache.filter(book => {

        return [

            book.title,

            book.author,

            book.category

        ].some(item =>

            String(item || "")
                .toLowerCase()
                .includes(term)

        );

    });

    renderBooks(filtered);

    text(
        "bookResults",
        `कुल ${filtered.length} किताबें मिलीं।`
    );

}


/* ================= CLEAR DEMO HISTORY ================= */

function clearDemoData() {

    if (currentUser) {

        toast(
            "आपकी Firebase Booking History सुरक्षित रखी गई है।"
        );

        return;

    }

    myBookings = [];

    renderHistory();

    toast("Demo History साफ कर दी गई।");

}


/* ================= SETUP UI ================= */

function setupUI() {

    setupLoginUI();

    if ($("startDate")) {

        $("startDate").min = todayDate();

        if (!$("startDate").value) {
            $("startDate").value = todayDate();
        }

    }

    if ($("lockerStartDate")) {

        $("lockerStartDate").min = todayDate();

        if (!$("lockerStartDate").value) {
            $("lockerStartDate").value = todayDate();
        }

    }

    $("slot")?.addEventListener(
        "change",
        () => {

            selectedSeat = null;

            renderSeatGrid();

            updateSummary();

        }
    );

    $("months")?.addEventListener(
        "change",
        updateSummary
    );

    $("startDate")?.addEventListener(
        "change",
        updateSummary
    );

    $("lockerMonths")?.addEventListener(
        "change",
        updateSummary
    );

    $("bookSearch")?.addEventListener(
        "input",
        searchBooks
    );

    renderSeatGrid();

    renderLockerGrid();

    updateSummary();

}


/* ================= AUTH STATE LISTENER ================= */

function startAuthListener() {

    onAuthStateChanged(

        auth,

        user => {

            currentUser = user || null;

            updateAuthUI(currentUser);

            if (currentUser) {

                startMyBookingsListener(currentUser);

            } else {

                if (myBookingListenerStop) {

                    myBookingListenerStop();

                    myBookingListenerStop = null;

                }

                myBookings = [];

                bookingsReady = false;

                renderHistory();

            }

            updateSummary();

        }

    );

}


/* ================= GLOBAL HTML FUNCTIONS ================= */

window.loginGoogle = loginGoogle;

window.logout = logout;

window.go = go;

window.setAuthMode = setAuthMode;

window.clearDemoData = clearDemoData;

window.prepareBooking = prepareBooking;

window.saveLocker = saveLocker;

window.searchBooks = searchBooks;

window.printReceipt = printReceipt;

window.showToast = toast;


/* ================= INITIALIZE WEBSITE ================= */

async function init() {

    setupUI();

    try {

        await getRedirectResult(auth);

    } catch (error) {

        console.warn(
            "Redirect result:",
            error
        );

        toast(
            authErrorMessage(error),
            "error"
        );

    }

    startAvailabilityListener();

    startBooksListener();

    startAuthListener();

}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
    );

} else {

    init();

}


/* =========================================================
   IMPORTANT SECURITY NOTES

   1. Student can access only their own booking records.
   2. Student must not set status = confirmed.
   3. Student must not set paymentStatus = verified.
   4. Only Admin / trusted backend can assign seats.
   5. Only Admin / trusted backend can update availability.
   6. UTR submission does not prove payment.
   7. Deposit history must be verified on the backend.
   8. Seat/locker reservation needs server-side protection
      against two students booking at the same time.

   Do not launch real payments until Database Rules and
   Admin verification are configured.
   ========================================================= */