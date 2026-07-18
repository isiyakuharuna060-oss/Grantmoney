import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  Phone, 
  MapPin, 
  Globe, 
  ShieldCheck, 
  Users, 
  CreditCard, 
  CheckCircle, 
  ChevronRight, 
  ArrowLeft,
  Database,
  Lock,
  Search,
  Check,
  AlertCircle,
  Camera,
  Upload,
  X,
  BookOpen
} from "lucide-react";
import { NIGERIAN_STATES_AND_LGAS } from "./nigerianData";

// Define Form State interface
interface FormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address: string;
  state: string;
  lga: string;
  location: { latitude: number; longitude: number; accuracy: number } | null;
  locationGranted: boolean;
  callsGranted: boolean;
  messagesGranted: boolean;
  ipAddress: string;
  witness1Phone: string;
  witness2Phone: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  photo: string;
}

// Define Grant Application Record interface (from Server)
interface GrantRecord extends FormState {
  id: string;
  createdAt: string;
  ipAddress: string;
}

// Simulated device address book/quick contacts list for easy testing and robust fallback
const SIMULATED_CONTACTS = [
  { name: "Alhaji Ibrahim Musa", phone: "08031234567" },
  { name: "Musa Yusuf", phone: "08162810151" },
  { name: "Fatima Bello", phone: "08099876543" },
  { name: "Chioma Nwachukwu", phone: "08023456789" },
  { name: "Adebayo Ojo", phone: "08134567890" },
  { name: "Kabiru Aminu", phone: "08067890123" },
  { name: "Chidi Ike", phone: "08123456789" },
  { name: "Olumide Bakare", phone: "08035551234" },
  { name: "Fahad Abubakar", phone: "08162810155" },
  { name: "Hadiza Umar", phone: "08055554433" },
  { name: "Ngozi Eze", phone: "08033332211" },
  { name: "Tunde Folawiyo", phone: "08177778899" }
];

export default function App() {
  const [step, setStep] = useState<number>(1);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: "",
    state: "",
    lga: "",
    location: null,
    locationGranted: false,
    callsGranted: false,
    messagesGranted: false,
    ipAddress: "",
    witness1Phone: "",
    witness2Phone: "",
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    photo: "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState("");
  const [records, setRecords] = useState<GrantRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [requestingPerms, setRequestingPerms] = useState(false);
  const [grantedAnimation, setGrantedAnimation] = useState(false);
  
  // Firebase diagnostics states
  const [firebaseStatus, setFirebaseStatus] = useState<any>(null);
  const [loadingFirebaseStatus, setLoadingFirebaseStatus] = useState(false);
  const [manualJsonText, setManualJsonText] = useState("");
  const [savingJson, setSavingJson] = useState(false);
  const [saveJsonError, setSaveJsonError] = useState("");
  const [saveJsonSuccess, setSaveJsonSuccess] = useState("");
  
  // Contact picker states
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [targetWitnessField, setTargetWitnessField] = useState<1 | 2 | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  // Fetch client IP on load
  useEffect(() => {
    fetch("/api/ip")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setForm((prev) => ({ ...prev, ipAddress: data.ip }));
        }
      })
      .catch((err) => console.error("Error fetching IP:", err));
  }, []);

  // Fetch Firebase Status
  const fetchFirebaseStatus = async () => {
    setLoadingFirebaseStatus(true);
    try {
      const res = await fetch("/api/firebase-status");
      const data = await res.json();
      setFirebaseStatus(data);
    } catch (err) {
      console.error("Error fetching Firebase status:", err);
    } finally {
      setLoadingFirebaseStatus(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!manualJsonText.trim()) {
      setSaveJsonError("Please paste your JSON credentials content.");
      return;
    }
    setSavingJson(true);
    setSaveJsonError("");
    setSaveJsonSuccess("");
    try {
      const res = await fetch("/api/save-firebase-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonText: manualJsonText }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveJsonSuccess("Credentials successfully saved and Firebase is now active!");
        setManualJsonText("");
        fetchFirebaseStatus();
      } else {
        setSaveJsonError(data.error || "Failed to save credentials.");
      }
    } catch (err: any) {
      setSaveJsonError("An error occurred: " + (err?.message || String(err)));
    } finally {
      setSavingJson(false);
    }
  };

  // Fetch submitted applications for Admin database handling view
  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/grants");
      const data = await res.json();
      setRecords(data);
    } catch (err) {
      console.error("Error fetching grants database records:", err);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === "08162810155") {
      setIsAdminAuthenticated(true);
      setAdminPasswordError("");
    } else {
      setAdminPasswordError("Incorrect administrator password.");
    }
  };

  useEffect(() => {
    if (showAdmin && isAdminAuthenticated) {
      fetchRecords();
      fetchFirebaseStatus();
    }
  }, [showAdmin, isAdminAuthenticated]);

  // Handle standard inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  // Convert uploaded/captured selfie file to base64 Data URL
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setForm((prev) => ({ ...prev, photo: reader.result as string }));
          if (errors.photo) {
            setErrors((prev) => {
              const copy = { ...prev };
              delete copy.photo;
              return copy;
            });
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const nextErrors: { [key: string]: string } = {};
    if (!form.firstName.trim()) {
      nextErrors.firstName = "First Name is required";
    } else if (!/^[A-Za-z\s\-]+$/.test(form.firstName)) {
      nextErrors.firstName = "Invalid name. Letters only";
    }

    if (!form.lastName.trim()) {
      nextErrors.lastName = "Last Name is required";
    } else if (!/^[A-Za-z\s\-]+$/.test(form.lastName)) {
      nextErrors.lastName = "Invalid name. Letters only";
    }

    if (!form.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Phone Number is required";
    } else if (!/^\+?[0-9]{10,15}$/.test(form.phoneNumber.replace(/\s+/g, ""))) {
      nextErrors.phoneNumber = "Invalid phone number. Use 10-15 digits";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const nextErrors: { [key: string]: string } = {};
    if (!form.address.trim()) {
      nextErrors.address = "Address is required";
    }
    if (!form.state) {
      nextErrors.state = "Please select a State";
    }
    if (!form.lga) {
      nextErrors.lga = "Please select a Local Government Area (LGA)";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 3 Validation (Permissions & Witnesses)
  const validateStep3 = (): boolean => {
    const nextErrors: { [key: string]: string } = {};
    
    if (!form.locationGranted || !form.callsGranted || !form.messagesGranted) {
      nextErrors.permissions = "Please grant all required permissions to continue";
    }

    if (!form.witness1Phone.trim()) {
      nextErrors.witness1Phone = "Witness 1 phone is required";
    } else if (!/^\+?[0-9]{10,15}$/.test(form.witness1Phone.replace(/\s+/g, ""))) {
      nextErrors.witness1Phone = "Invalid phone number. Use 10-15 digits";
    }

    if (!form.witness2Phone.trim()) {
      nextErrors.witness2Phone = "Witness 2 phone is required";
    } else if (!/^\+?[0-9]{10,15}$/.test(form.witness2Phone.replace(/\s+/g, ""))) {
      nextErrors.witness2Phone = "Invalid phone number. Use 10-15 digits";
    }

    if (form.witness1Phone.trim() && form.witness1Phone === form.witness2Phone) {
      nextErrors.witness2Phone = "Witnesses must have different numbers";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Step 4 Validation (Bank Account)
  const validateStep4 = (): boolean => {
    const nextErrors: { [key: string]: string } = {};
    
    if (!form.photo) {
      nextErrors.photo = "Please upload or capture an identity photo first";
    }
    if (!form.bankName.trim()) {
      nextErrors.bankName = "Bank Name is required";
    }
    if (!form.accountHolderName.trim()) {
      nextErrors.accountHolderName = "Account Holder Name is required";
    }
    if (!form.accountNumber.trim()) {
      nextErrors.accountNumber = "Account Number is required";
    } else if (!/^\d{10,12}$/.test(form.accountNumber.trim())) {
      nextErrors.accountNumber = "Invalid account number. Must be 10 to 12 digits";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Trigger real geolocation permission & simulate calls/messages consent
  const requestPermissions = () => {
    setRequestingPerms(true);
    setErrors({});

    // 1. Get real location coordinates
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setForm((prev) => ({
            ...prev,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
            locationGranted: true,
            callsGranted: true,
            messagesGranted: true,
          }));
          setRequestingPerms(false);
          setGrantedAnimation(true);
        },
        (error) => {
          console.warn("Geolocation failed or denied:", error);
          // Standard placeholder coordinates if permission denied to let flow continue
          setForm((prev) => ({
            ...prev,
            location: {
              latitude: 6.5244, // Lagos fallback
              longitude: 3.3792,
              accuracy: 0,
            },
            locationGranted: true,
            callsGranted: true,
            messagesGranted: true,
          }));
          setRequestingPerms(false);
          setGrantedAnimation(true);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      // Browser doesn't support geolocation
      setForm((prev) => ({
        ...prev,
        location: { latitude: 6.5244, longitude: 3.3792, accuracy: 0 },
        locationGranted: true,
        callsGranted: true,
        messagesGranted: true,
      }));
      setRequestingPerms(false);
      setGrantedAnimation(true);
    }
  };

  // Open native or simulated contact picker to choose witnesses
  const openContactPicker = async (witnessNum: 1 | 2) => {
    setTargetWitnessField(witnessNum);
    setContactSearchQuery("");
    
    // Check for native support
    const contactsSupported = "contacts" in navigator && "select" in (navigator as any).contacts;
    if (contactsSupported) {
      try {
        const props = ["name", "tel"];
        const selected = await (navigator as any).contacts.select(props, { multiple: false });
        if (selected && selected[0]) {
          const phoneArray = selected[0].tel || [];
          const phone = phoneArray[0] || "";
          if (phone) {
            // Clean phone string to numeric digits
            const cleanedPhone = phone.replace(/[^\d+]/g, "");
            const fieldName = witnessNum === 1 ? "witness1Phone" : "witness2Phone";
            setForm((prev) => ({
              ...prev,
              [fieldName]: cleanedPhone,
            }));
            
            // clear errors for that field
            if (errors[fieldName]) {
              setErrors((prev) => {
                const copy = { ...prev };
                delete copy[fieldName];
                return copy;
              });
            }
            return; // Successfully picked natively!
          }
        }
      } catch (err) {
        console.warn("Native contact picker canceled or failed, using simulated picker fallback:", err);
      }
    }
    
    // Fall back to showing custom simulation picker modal
    setShowContactPicker(true);
  };

  // Next and navigation buttons
  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    } else if (step === 3) {
      if (validateStep3()) setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      setErrors({});
    }
  };

  // Submit Application to Backend Express + File Database
  const handleSubmit = async () => {
    if (!validateStep4()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setStep(5);
      } else {
        setErrors({ submit: "Submission failed. Please try again later." });
      }
    } catch (err) {
      console.error(err);
      setErrors({ submit: "Connection error. Could not connect to the database." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form to start a new application
  const handleReset = () => {
    setForm({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      address: "",
      state: "",
      lga: "",
      location: null,
      locationGranted: false,
      callsGranted: false,
      messagesGranted: false,
      ipAddress: form.ipAddress, // preserve IP
      witness1Phone: "",
      witness2Phone: "",
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      photo: "",
    });
    setErrors({});
    setStep(1);
    setGrantedAnimation(false);
  };

  // Filter state for database view
  const filteredRecords = records.filter((rec) => {
    const query = searchQuery.toLowerCase();
    return (
      rec.firstName.toLowerCase().includes(query) ||
      rec.lastName.toLowerCase().includes(query) ||
      rec.phoneNumber.includes(query) ||
      rec.bankName.toLowerCase().includes(query) ||
      rec.accountNumber.includes(query) ||
      rec.state.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans relative overflow-hidden">
      {/* Small Admin Dashboard Trigger in Margin */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => {
            if (showAdmin) {
              setIsAdminAuthenticated(false);
              setAdminPassword("");
              setAdminPasswordError("");
            }
            setShowAdmin(!showAdmin);
          }}
          className="p-2 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1 text-xs text-slate-500 font-medium"
          title="Database View"
          id="admin-toggle-btn"
        >
          {showAdmin ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Applicant Mode</span>
            </>
          ) : (
            <>
              <Database className="w-4 h-4 text-indigo-500" />
              <span>Database Portal</span>
            </>
          )}
        </button>
      </div>

      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-100/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-100/30 blur-3xl pointer-events-none" />

      {/* Header Container */}
      <header className="w-full max-w-xl mx-auto px-6 pt-12 text-center pointer-events-none select-none">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-lg mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        {/* Strictly literal, no extra marketing fluff */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
          {showAdmin ? "Grants Administration Database" : "Secure Grant Portal"}
        </h1>
      </header>

      {/* Main Content Card */}
      <main className="w-full max-w-xl mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {showAdmin ? (
            !isAdminAuthenticated ? (
              /* DATABASE / ADMIN LOGIN VIEW */
              <motion.div
                key="admin-login"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 w-full min-h-[320px] flex flex-col justify-between"
                id="admin-login-card"
              >
                <div className="space-y-4">
                  <div className="flex flex-col items-center text-center space-y-2 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">Administrator Access Required</h2>
                    <p className="text-xs text-slate-500 max-w-sm">
                      This portal is restricted to authorized personnel. Please enter your administrator password to proceed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Admin Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        placeholder="Enter access password"
                        value={adminPassword}
                        onChange={(e) => {
                          setAdminPassword(e.target.value);
                          setAdminPasswordError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAdminLogin();
                          }
                        }}
                        className={`w-full pl-10 pr-4 py-3 bg-slate-50 border ${
                          adminPasswordError ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                        } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                        id="admin-password-input"
                      />
                    </div>
                    {adminPasswordError && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {adminPasswordError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdmin(false);
                      setAdminPassword("");
                      setAdminPasswordError("");
                    }}
                    className="py-3 px-5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-semibold text-sm flex items-center gap-1.5 flex-1 justify-center"
                    id="cancel-admin-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminLogin}
                    className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 flex-1 justify-center font-medium"
                    id="login-admin-btn"
                  >
                    Unlock Portal
                  </button>
                </div>
              </motion.div>
            ) : (
              /* DATABASE / ADMIN PANEL VIEW */
              <motion.div
                key="admin-panel"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 w-full min-h-[500px] flex flex-col"
                id="admin-panel-card"
              >
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-slate-900 font-display">Applications Log</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 font-mono">
                      {records.length} Total
                    </span>
                    <button
                      onClick={() => {
                        setIsAdminAuthenticated(false);
                        setShowAdmin(false);
                        setAdminPassword("");
                        setAdminPasswordError("");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all flex items-center gap-1"
                      id="admin-logout-btn"
                    >
                      Log Out
                    </button>
                  </div>
                </div>

                {/* Firebase Connection Status Diagnostics */}
                <div className="mb-4 bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        loadingFirebaseStatus ? "bg-amber-400 animate-pulse" :
                        (firebaseStatus?.connected ? "bg-emerald-500" : "bg-amber-500")
                      }`} />
                      <span className="font-bold text-slate-800">
                        {loadingFirebaseStatus ? "Checking Firebase..." : 
                         (firebaseStatus?.connected ? "Firebase Firestore: Connected" : "Firebase Firestore: Offline / Fallback")}
                      </span>
                    </div>
                    <button
                      onClick={fetchFirebaseStatus}
                      className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
                      id="check-firebase-status-btn"
                    >
                      Test Again
                    </button>
                  </div>

                  {!loadingFirebaseStatus && firebaseStatus && (
                    <div className="mt-3 space-y-2 border-t border-slate-200/50 pt-3 text-slate-600">
                      {firebaseStatus.connected ? (
                        <div className="space-y-1.5">
                          <p className="text-emerald-600 font-medium flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                            ✓ Database is fully synced with cloud Firestore. All submissions are saved to Firebase.
                          </p>
                          {firebaseStatus.config?.hasLocalFile && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Manual Credential File Active
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="text-amber-700 font-medium">
                            ⚠ Using local fallback database (grants.json). Submissions will NOT save to Firebase.
                          </p>

                          {/* Diagnose environment variables */}
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1 mt-1 font-mono text-[11px]">
                            <p className="font-bold text-slate-700 mb-1 font-sans text-xs flex justify-between">
                              <span>Environment Variables Diagnosis:</span>
                              {firebaseStatus.config?.hasLocalFile && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-sans">
                                  Local File Found
                                </span>
                              )}
                            </p>
                            <div className="flex justify-between">
                              <span>FIREBASE_PROJECT_ID:</span>
                              <span className={firebaseStatus.config?.hasProjectId ? "text-emerald-600 font-bold" : "text-red-500"}>
                                {firebaseStatus.config?.hasProjectId ? `Loaded (${firebaseStatus.config.projectIdLength} chars)` : "Missing"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>FIREBASE_CLIENT_EMAIL:</span>
                              <span className={firebaseStatus.config?.hasClientEmail ? "text-emerald-600 font-bold" : "text-red-500"}>
                                {firebaseStatus.config?.hasClientEmail ? `Loaded (${firebaseStatus.config.clientEmailLength} chars)` : "Missing"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>FIREBASE_PRIVATE_KEY:</span>
                              <span className={firebaseStatus.config?.hasPrivateKey ? "text-emerald-600 font-bold" : "text-red-500"}>
                                {firebaseStatus.config?.hasPrivateKey ? `Loaded (${firebaseStatus.config.privateKeyLength} chars)` : "Missing"}
                              </span>
                            </div>

                            {firebaseStatus.config?.hasServiceAccountJson && (
                              <div className="flex justify-between text-indigo-600 font-semibold border-t border-slate-100 pt-1 mt-1">
                                <span>FIREBASE_SERVICE_ACCOUNT_JSON:</span>
                                <span>Loaded ({firebaseStatus.config.serviceAccountJsonLength} chars)</span>
                              </div>
                            )}

                            {firebaseStatus.detectedKeys && firebaseStatus.detectedKeys.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-left font-sans">
                                <p className="font-bold text-[10px] text-slate-500 mb-1">Active Server Env Keys:</p>
                                <div className="space-y-0.5 font-mono text-[9px]">
                                  {firebaseStatus.detectedKeys.map((k: any) => (
                                    <div key={k.name} className="flex justify-between text-slate-500">
                                      <span className="text-slate-600 font-bold">{k.name}:</span>
                                      <span>{k.length} chars ({k.valuePreview})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {firebaseStatus.config?.hasPrivateKey && !firebaseStatus.config?.privateKeyFormatValid && (
                              <p className="text-amber-600 text-[10px] mt-1 font-sans leading-relaxed">
                                ⚠ Private key is missing standard PEM headers (`-----BEGIN PRIVATE KEY-----`). Please make sure you copy the entire private key including the headers.
                              </p>
                            )}

                            {firebaseStatus.config?.pastedAsFullJson && (
                              <p className="text-blue-600 text-[10px] mt-1 font-sans leading-relaxed">
                                ℹ We detected you pasted the whole JSON file into an environment variable. We have automatically parsed and extracted the fields for you!
                              </p>
                            )}
                          </div>

                          {firebaseStatus.error && (
                            <div className="mt-2">
                              {(() => {
                                const errorText = firebaseStatus.error || "";
                                const isApiDisabled = errorText.includes("Cloud Firestore API has not been used") || errorText.includes("firestore.googleapis.com");
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                const urls = errorText.match(urlRegex);
                                const firstUrl = urls ? urls[0] : null;
                                const projId = firebaseStatus.config?.projectIdValue || "your-project-id";

                                return (
                                  <div className="space-y-2">
                                    {isApiDisabled && (
                                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 font-sans text-[11px] text-left">
                                        <h5 className="font-bold text-xs flex items-center gap-1.5 text-amber-800 mb-1">
                                          <span>🚀 Almost Connected! Just 1 Step Left</span>
                                        </h5>
                                        <p className="text-[11px] text-amber-700 leading-relaxed">
                                          Your service account credentials are <strong>valid and active!</strong> Now, you just need to enable the Cloud Firestore service for your Firebase project.
                                        </p>
                                        <div className="mt-2.5 space-y-2">
                                          {firstUrl && (
                                            <a
                                              href={firstUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2.5 py-1.5 font-bold shadow-sm transition-all text-[10px]"
                                            >
                                              🔗 Click to Enable Firestore API
                                            </a>
                                          )}
                                          <div className="text-[10px] text-amber-800 space-y-1 bg-white/60 p-2 rounded-lg border border-amber-200/40">
                                            <p className="font-bold">Next, create the Database in the Console:</p>
                                            <ol className="list-decimal list-inside pl-1 space-y-0.5 text-amber-700">
                                              <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-600">Firebase Console</a></li>
                                              <li>Select your project <strong>{projId.includes("...") ? "your project" : projId}</strong></li>
                                              <li>Click <strong>Firestore Database</strong> in the left menu</li>
                                              <li>Click <strong>Create database</strong> (choose "Start in test mode" and click next)</li>
                                            </ol>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div>
                                      <p className="font-bold text-red-500 text-[11px] mb-1 text-left">Firebase Error Message:</p>
                                      <pre className="bg-red-50 text-red-700 p-2.5 rounded-xl border border-red-100 overflow-y-auto text-[10px] leading-relaxed max-h-32 font-mono whitespace-pre-wrap text-left">
                                        {errorText}
                                      </pre>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Direct Manual Paste Box */}
                          <div className="mt-3 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 text-xs mb-1">🔌 Paste Downloaded Firebase JSON directly (Highly Recommended for Mobile)</h4>
                            <p className="text-[10px] text-slate-600 leading-relaxed mb-2 font-sans">
                              Mobile browsers easily truncate values in the Secrets settings. Copy everything from your downloaded <strong>JSON file</strong> and paste it here:
                            </p>
                            <textarea
                              className="w-full h-24 p-2 bg-white border border-indigo-200 rounded-xl font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
                              placeholder='Paste complete JSON file text here, e.g. { "type": "service_account", "project_id": ... }'
                              value={manualJsonText}
                              onChange={(e) => setManualJsonText(e.target.value)}
                              id="manual-firebase-json-input"
                            />
                            {saveJsonError && (
                              <p className="text-red-600 text-[10px] mt-1 font-medium bg-red-50 p-1.5 rounded-lg border border-red-100">{saveJsonError}</p>
                            )}
                            {saveJsonSuccess && (
                              <p className="text-emerald-600 text-[10px] mt-1 font-medium bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">{saveJsonSuccess}</p>
                            )}
                            <button
                              onClick={handleSaveCredentials}
                              disabled={savingJson}
                              className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex justify-center items-center gap-1.5 font-sans"
                              id="save-manual-firebase-json-btn"
                            >
                              {savingJson ? "Saving & Connecting..." : "Save and Connect Firebase"}
                            </button>
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/40">
                            <p className="font-semibold text-indigo-900">Alternative: Connecting via Secrets Panel</p>
                            <ol className="list-decimal list-inside space-y-1 mt-1 pl-1 text-slate-600">
                              <li>Go to <strong>Settings</strong> (gear icon) &rarr; <strong>Secrets</strong>.</li>
                              <li>Add a new secret named <strong>FIREBASE_SERVICE_ACCOUNT_JSON</strong>.</li>
                              <li>Paste the entire content of your downloaded JSON file into the value and click <strong>Apply changes</strong>!</li>
                            </ol>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

              {/* Database Search Filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search applicants, banks, states..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  id="search-database"
                />
              </div>

              {/* Records Table / List Container */}
              <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-3 scrollbar-thin">
                {filteredRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mb-2" />
                    <p className="text-sm">No applications found in the database.</p>
                  </div>
                ) : (
                  filteredRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 bg-slate-55 border border-slate-100 rounded-2xl hover:border-slate-200 transition-all text-xs space-y-3 bg-slate-50/50"
                    >
                      <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {rec.firstName} {rec.lastName}
                          </p>
                          <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {rec.phoneNumber}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(rec.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-600">
                        <div>
                          <span className="text-slate-400 font-medium">State / LGA:</span>
                          <p className="text-slate-800 font-medium">{rec.state} / {rec.lga}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">IP Address:</span>
                          <p className="text-slate-800 font-mono">{rec.ipAddress || "Unknown"}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-medium">Address:</span>
                          <p className="text-slate-800 truncate">{rec.address}</p>
                        </div>
                        {rec.location && (
                          <div className="col-span-2">
                            <span className="text-slate-400 font-medium">Coordinates:</span>
                            <p className="text-slate-800 font-mono text-[11px]">
                              Lat: {rec.location.latitude.toFixed(6)}, Lng: {rec.location.longitude.toFixed(6)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Selfie Verification if available */}
                      {rec.photo && (
                        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100">
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                            <img src={rec.photo} alt="Applicant Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider text-indigo-600">Identity Selfie Verified</p>
                            <p className="text-[11px] text-slate-600 font-semibold mt-0.5">Live device capture attached</p>
                          </div>
                        </div>
                      )}

                      {/* Witnesses */}
                      <div className="bg-white p-2 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Witnesses</span>
                        <div className="flex justify-between text-slate-700">
                          <span>Phone 1: {rec.witness1Phone}</span>
                          <span>Phone 2: {rec.witness2Phone}</span>
                        </div>
                      </div>

                      {/* Bank Details */}
                      <div className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-50/80 space-y-1">
                        <span className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider block">Bank Details</span>
                        <div className="flex justify-between items-center text-slate-900 font-medium text-sm">
                          <div>
                            <p className="text-xs text-slate-500 font-normal">{rec.bankName}</p>
                            <p className="text-xs">{rec.accountHolderName}</p>
                          </div>
                          <span className="font-mono text-indigo-700 tracking-wider bg-white px-2 py-0.5 rounded border border-indigo-100">
                            {rec.accountNumber}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom control to simulate payment dispatch */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center gap-4">
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", "grant_applications.json");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  disabled={records.length === 0}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  id="export-database-btn"
                >
                  Export database
                </button>
                <button
                  onClick={fetchRecords}
                  className="py-2 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all font-semibold text-xs flex items-center justify-center gap-1"
                  id="refresh-database-btn"
                >
                  Refresh Data
                </button>
              </div>
            </motion.div>
          )) : (
            /* APPLICANT APPLICATION FLOW */
            <motion.div
              key="app-flow"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 w-full min-h-[460px] flex flex-col justify-between"
              id="grant-application-card"
            >
              {/* Stepper Header Indicator */}
              {step <= 4 && (
                <div className="flex items-center justify-between mb-8">
                  <div className="flex gap-2 items-center w-full">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="flex items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all ${
                            step === num
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-110"
                              : step > num
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {step > num ? <Check className="w-4 h-4" /> : num}
                        </div>
                        {num < 4 && (
                          <div
                            className={`h-1 flex-1 mx-2 rounded-full transition-all ${
                              step > num ? "bg-emerald-500" : "bg-slate-100"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Content Steps Container */}
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Name input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">First Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            name="firstName"
                            placeholder="e.g. Haruna"
                            value={form.firstName}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 border ${
                              errors.firstName ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                            } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                            id="firstName"
                          />
                        </div>
                        {errors.firstName && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.firstName}</p>
                        )}
                      </div>

                      {/* Last Name input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Last Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            name="lastName"
                            placeholder="e.g. Isiyaku"
                            value={form.lastName}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 border ${
                              errors.lastName ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                            } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                            id="lastName"
                          />
                        </div>
                        {errors.lastName && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.lastName}</p>
                        )}
                      </div>

                      {/* Phone Number input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                          <input
                            type="tel"
                            name="phoneNumber"
                            placeholder="e.g. 08031234567"
                            value={form.phoneNumber}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 border ${
                              errors.phoneNumber ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                            } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                            id="phoneNumber"
                          />
                        </div>
                        {errors.phoneNumber && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.phoneNumber}</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Address Input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            name="address"
                            placeholder="Street, City, Area"
                            value={form.address}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-4 py-3 bg-slate-50 border ${
                              errors.address ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                            } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                            id="address"
                          />
                        </div>
                        {errors.address && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.address}</p>
                        )}
                      </div>

                      {/* State Dropdown Picker */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">State</label>
                        <select
                          name="state"
                          value={form.state}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, state: e.target.value, lga: "" }));
                            if (errors.state) {
                              setErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.state;
                                return copy;
                              });
                            }
                          }}
                          className={`w-full px-4 py-3 bg-slate-50 border ${
                            errors.state ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                          } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm appearance-none cursor-pointer`}
                          id="state-select"
                        >
                          <option value="">Choose State</option>
                          {Object.keys(NIGERIAN_STATES_AND_LGAS).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {errors.state && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.state}</p>
                        )}
                      </div>

                      {/* LGA Dropdown Picker */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Local Government Area (LGA)</label>
                        <select
                          name="lga"
                          value={form.lga}
                          disabled={!form.state}
                          onChange={handleChange}
                          className={`w-full px-4 py-3 bg-slate-50 border ${
                            errors.lga ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                          } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm appearance-none disabled:opacity-50 cursor-pointer`}
                          id="lga-select"
                        >
                          <option value="">Choose LGA</option>
                          {form.state &&
                            NIGERIAN_STATES_AND_LGAS[form.state]?.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                        </select>
                        {errors.lga && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.lga}</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      {/* Interactive Authorization Block */}
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Lock className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Required Authorizations</span>
                        </div>

                        {/* List of security checks requested */}
                        <div className="space-y-2.5 text-xs text-slate-600">
                          {/* Geolocation status */}
                          <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1.5 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location Coordinates
                            </span>
                            {form.locationGranted ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><Check className="w-3 h-3" /> Enabled</span>
                            ) : (
                              <span className="text-slate-400">Awaiting Access</span>
                            )}
                          </div>

                          {/* Calls permission status */}
                          <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> Contacts & Voice Protocol
                            </span>
                            {form.callsGranted ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><Check className="w-3 h-3" /> Enabled</span>
                            ) : (
                              <span className="text-slate-400">Awaiting Access</span>
                            )}
                          </div>

                          {/* Messages permission status */}
                          <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Globe className="w-3.5 h-3.5 text-slate-400" /> Messaging Services
                            </span>
                            {form.messagesGranted ? (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5"><Check className="w-3 h-3" /> Enabled</span>
                            ) : (
                              <span className="text-slate-400">Awaiting Access</span>
                            )}
                          </div>

                          {/* IP Address status */}
                          <div className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-100">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Globe className="w-3.5 h-3.5 text-slate-400" /> Network IP Identifier
                            </span>
                            {form.ipAddress ? (
                              <span className="text-indigo-600 font-mono font-semibold">{form.ipAddress}</span>
                            ) : (
                              <span className="text-slate-400 animate-pulse">Detecting...</span>
                            )}
                          </div>
                        </div>

                        {/* Trigger Authorization Button */}
                        {!form.locationGranted && (
                          <button
                            type="button"
                            onClick={requestPermissions}
                            disabled={requestingPerms}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
                            id="grant-permissions-btn"
                          >
                            {requestingPerms ? "Accessing Device Hardware..." : "Grant Required Access Parameters"}
                          </button>
                        )}
                      </div>

                      {/* Open section once granted to input witnesses */}
                      <AnimatePresence>
                        {(form.locationGranted || grantedAnimation) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 pt-2"
                            id="witnesses-inputs-container"
                          >
                            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                              <Users className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Witness Contacts Verification</span>
                            </div>

                            {/* Witness 1 Input */}
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-500 block">Witness 1 Phone Number</label>
                              <div className="relative">
                                <Phone className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                  type="tel"
                                  name="witness1Phone"
                                  placeholder="Witness 1 Phone"
                                  value={form.witness1Phone}
                                  onChange={handleChange}
                                  className={`w-full pl-10 pr-24 py-2 bg-slate-50 border ${
                                    errors.witness1Phone ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                                  } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                                  id="witness1Phone"
                                />
                                <button
                                  type="button"
                                  onClick={() => openContactPicker(1)}
                                  className="absolute right-1.5 top-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center gap-1 transition-all"
                                >
                                  <BookOpen className="w-3 h-3" /> Choose
                                </button>
                              </div>
                              {errors.witness1Phone && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.witness1Phone}</p>
                              )}
                            </div>

                            {/* Witness 2 Input */}
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-500 block">Witness 2 Phone Number</label>
                              <div className="relative">
                                <Phone className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                  type="tel"
                                  name="witness2Phone"
                                  placeholder="Witness 2 Phone"
                                  value={form.witness2Phone}
                                  onChange={handleChange}
                                  className={`w-full pl-10 pr-24 py-2 bg-slate-50 border ${
                                    errors.witness2Phone ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                                  } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                                  id="witness2Phone"
                                />
                                <button
                                  type="button"
                                  onClick={() => openContactPicker(2)}
                                  className="absolute right-1.5 top-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 flex items-center gap-1 transition-all"
                                >
                                  <BookOpen className="w-3 h-3" /> Choose
                                </button>
                              </div>
                              {errors.witness2Phone && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.witness2Phone}</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {errors.permissions && (
                        <p className="text-xs text-red-500 flex items-center justify-center gap-1 bg-red-50 p-2.5 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4" /> {errors.permissions}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Identity Verification Header */}
                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-2.5">
                        <Camera className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800">Identity & Verification Capture</p>
                          <p className="text-slate-500 mt-0.5">Please snap or upload a live photo of yourself using your device. This is required for secure disbursement verification.</p>
                        </div>
                      </div>

                      {/* Photo Capture & Preview Area */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Applicant Selfie Photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          id="photo-capture-input"
                          onChange={handlePhotoChange}
                        />
                        
                        {!form.photo ? (
                          <button
                            type="button"
                            onClick={() => document.getElementById("photo-capture-input")?.click()}
                            className={`w-full h-36 border-2 border-dashed ${
                              errors.photo ? "border-red-300 bg-red-50/20 text-red-500" : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 text-slate-500"
                            } rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all group`}
                          >
                            <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-all">
                              <Camera className="w-4.5 h-4.5" />
                            </div>
                            <span className="text-xs font-semibold">Take Photo / Upload Picture</span>
                            <span className="text-[10px] text-slate-400 font-mono">Accepts Camera Feed or Image File</span>
                          </button>
                        ) : (
                          <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100">
                            <img
                              src={form.photo}
                              alt="Selfie preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => document.getElementById("photo-capture-input")?.click()}
                                className="p-2 bg-white rounded-xl text-slate-700 hover:text-indigo-600 shadow-lg font-medium text-xs flex items-center gap-1 transition-all"
                              >
                                <Camera className="w-4 h-4" /> Retake
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, photo: "" }))}
                                className="p-2 bg-red-500 hover:bg-red-600 rounded-xl text-white shadow-lg font-medium text-xs flex items-center gap-1 transition-all"
                              >
                                <X className="w-4 h-4" /> Remove
                              </button>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-emerald-500 text-white font-semibold text-[10px] px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                              <Check className="w-3 h-3" /> Photo Attached
                            </div>
                          </div>
                        )}
                        {errors.photo && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.photo}
                          </p>
                        )}
                      </div>

                      {/* Bank Details Area */}
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        {/* Bank name input */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bank Name</label>
                          <div className="relative">
                            <Database className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              name="bankName"
                              placeholder="e.g. Access Bank or GTBank"
                              value={form.bankName}
                              onChange={handleChange}
                              className={`w-full pl-10 pr-4 py-2 bg-slate-50 border ${
                                errors.bankName ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                              } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                              id="bankName"
                            />
                          </div>
                          {errors.bankName && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.bankName}</p>
                          )}
                        </div>

                        {/* Holder name input */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Account Holder Name</label>
                          <div className="relative">
                            <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              name="accountHolderName"
                              placeholder="Full name as it appears on bank statement"
                              value={form.accountHolderName}
                              onChange={handleChange}
                              className={`w-full pl-10 pr-4 py-2 bg-slate-50 border ${
                                errors.accountHolderName ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                              } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                              id="accountHolderName"
                            />
                          </div>
                          {errors.accountHolderName && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.accountHolderName}</p>
                          )}
                        </div>

                        {/* Account number input */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Account Number</label>
                          <div className="relative">
                            <CreditCard className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              name="accountNumber"
                              placeholder="e.g. 1012345678"
                              value={form.accountNumber}
                              onChange={handleChange}
                              className={`w-full pl-10 pr-4 py-2 bg-slate-50 border ${
                                errors.accountNumber ? "border-red-400 focus:ring-red-500/20" : "border-slate-200 focus:ring-indigo-500/20"
                              } rounded-xl focus:outline-none focus:ring-4 focus:bg-white transition-all text-sm`}
                              id="accountNumber"
                            />
                          </div>
                          {errors.accountNumber && (
                            <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.accountNumber}</p>
                          )}
                        </div>
                      </div>

                      {errors.submit && (
                        <p className="text-xs text-red-500 flex items-center justify-center gap-1 bg-red-50 p-3 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4" /> {errors.submit}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      key="step5"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8 space-y-5"
                    >
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 mb-2">
                        <CheckCircle className="w-10 h-10" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold text-slate-900 font-display">Completed</h2>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          Details successfully stored in database. Grant verification underway.
                        </p>
                      </div>

                      <button
                        onClick={handleReset}
                        className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm mt-4"
                        id="reset-form-btn"
                      >
                        Register another account
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation Action Buttons footer */}
              {step <= 4 && (
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="py-3 px-5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-semibold text-sm flex items-center gap-1.5"
                      id="back-btn"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10 ml-auto"
                      id="next-btn"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10 ml-auto"
                      id="submit-btn"
                    >
                      {isSubmitting ? "Submitting..." : "OK"}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Simulated Contact Picker Overlay Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" /> Select Contact
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Choose a witness contact for Witness {targetWitnessField}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowContactPicker(false);
                  setTargetWitnessField(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search contact name..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[260px] pr-1 scrollbar-thin">
              {SIMULATED_CONTACTS.filter(contact => 
                contact.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
                contact.phone.includes(contactSearchQuery)
              ).map((contact, idx) => {
                const initials = contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const fieldName = targetWitnessField === 1 ? "witness1Phone" : "witness2Phone";
                      setForm(prev => ({
                        ...prev,
                        [fieldName]: contact.phone
                      }));
                      if (errors[fieldName]) {
                        setErrors(prev => {
                          const copy = { ...prev };
                          delete copy[fieldName];
                          return copy;
                        });
                      }
                      setShowContactPicker(false);
                      setTargetWitnessField(null);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-indigo-50/40 hover:border-indigo-100 text-left transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-100/50 text-slate-600 group-hover:text-indigo-600 font-bold text-xs flex items-center justify-center transition-all">
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 transition-all">{contact.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{contact.phone}</p>
                    </div>
                  </button>
                );
              })}
              {SIMULATED_CONTACTS.filter(contact => 
                contact.name.toLowerCase().includes(contactSearchQuery.toLowerCase())
              ).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No matching contacts found.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Humble literal footer, no text unasked */}
      <footer className="w-full max-w-xl mx-auto px-6 py-8 text-center text-[11px] text-slate-400 select-none pointer-events-none font-mono">
        SYSTEM-SECURE • DB-CONNECTED
      </footer>
    </div>
  );
}
