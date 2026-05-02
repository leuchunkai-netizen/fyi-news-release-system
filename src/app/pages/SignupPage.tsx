import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUser } from "../context/UserContext";
import {
  checkSignupEmailTaken,
  getAuthErrorMessage,
  getCurrentUserWithInterests,
  signUp,
  signupErrorIndicatesEmailTaken,
  SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
} from "@/lib/api/auth";
import { getCategories } from "../../lib/api/categories";
import type { CategoryRow } from "../../lib/types/database";
import { Check } from "lucide-react";
import {
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidCardByLuhn,
  isValidExpiry,
} from "../../lib/cardValidation";

type FieldKey =
  | "name"
  | "email"
  | "password"
  | "confirmPassword"
  | "gender"
  | "age"
  | "location"
  | "interests"
  | "cardName"
  | "cardNumber"
  | "expiry"
  | "cvc";

type FieldErrors = Partial<Record<FieldKey, string>>;

function looksLikeEmail(email: string): boolean {
  const t = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function inputErrorClass(hasError: boolean): string {
  return hasError ? "border-red-600 ring-1 ring-red-600" : "border-gray-200";
}

export function SignupPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<"free" | "premium">("free");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "",
    age: "",
    location: "",
  });
  const [interests, setInterests] = useState<string[]>([]);
  const [availableInterests, setAvailableInterests] = useState<CategoryRow[]>([]);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [checkingSignupEmail, setCheckingSignupEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const remindEmailTaken = () => {
    setFieldErrors((prev) => ({
      ...prev,
      email: SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
    }));
    setError("Please fix the highlighted fields below.");
  };

  async function gateEmailAvailableBeforeProceed(emailTrim: string): Promise<boolean> {
    const taken = await checkSignupEmailTaken(emailTrim);
    if (taken !== true) return true;
    remindEmailTaken();
    return false;
  }

  const clearField = (key: FieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
    clearField("interests");
  };

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    getCategories().then(setAvailableInterests).catch(() => setAvailableInterests([]));
  }, []);

  function validateStep1(): boolean {
    const err: FieldErrors = {};
    const name = formData.name.trim();
    if (!name) err.name = "Please enter your full name.";
    else if (name.length > 120) err.name = "Name is too long (max 120 characters).";

    const email = formData.email.trim();
    if (!email) err.email = "Please enter your email address.";
    else if (!looksLikeEmail(email)) err.email = "Please enter a valid email address.";

    if (!formData.password) err.password = "Please enter a password.";
    else if (formData.password.length < 6)
      err.password = "Password must be at least 6 characters.";

    if (!formData.confirmPassword) err.confirmPassword = "Please confirm your password.";
    else if (formData.password !== formData.confirmPassword)
      err.confirmPassword = "Passwords do not match.";

    if (!formData.gender.trim())
      err.gender = "Please select your gender.";

    const ageRaw = formData.age.trim();
    if (!ageRaw) err.age = "Please enter your age.";
    else {
      const parsed = Number(ageRaw);
      if (!Number.isFinite(parsed) || parsed < 13 || parsed > 120)
        err.age = "Age must be a whole number between 13 and 120.";
    }

    const loc = formData.location.trim();
    if (!loc) err.location = "Please enter your location (e.g. city, country).";
    else if (loc.length > 200) err.location = "Location is too long (max 200 characters).";

    setFieldErrors((prev) => {
      const next = { ...prev };
      (
        ["name", "email", "password", "confirmPassword", "gender", "age", "location"] as FieldKey[]
      ).forEach((k) => delete next[k]);
      return { ...next, ...err };
    });

    setError(Object.keys(err).length ? "Please fix the highlighted fields below." : null);
    return Object.keys(err).length === 0;
  }

  function validateStep2(): boolean {
    if (availableInterests.length > 0 && interests.length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        interests: "Select at least one category you are interested in.",
      }));
      setError("Please fix the highlighted fields below.");
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.interests;
      return next;
    });
    return true;
  }

  function validateStep3(): boolean {
    const err: FieldErrors = {};
    if (!cardName.trim()) err.cardName = "Please enter the name on the card.";
    if (!isValidCardByLuhn(cardNumber))
      err.cardNumber =
        digitsOnly(cardNumber).length < 12
          ? "Please enter a complete card number."
          : "Card number doesn't look valid. Double-check the digits.";
    if (!isValidExpiry(expiry)) {
      err.expiry = "Enter a valid expiry date (MM/YY) that is not in the past.";
    }
    const cvcDigits = digitsOnly(cvc);
    if (cvcDigits.length < 3 || cvcDigits.length > 4)
      err.cvc = "Enter a 3- or 4-digit security code.";

    setFieldErrors((prev) => {
      const next = { ...prev };
      (["cardName", "cardNumber", "expiry", "cvc"] as FieldKey[]).forEach((k) => delete next[k]);
      return { ...next, ...err };
    });

    setError(Object.keys(err).length ? "Please fix the highlighted fields below." : null);
    return Object.keys(err).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      if (!validateStep1()) return;
      const emailTrim = formData.email.trim();
      setCheckingSignupEmail(true);
      try {
        const ok = await gateEmailAvailableBeforeProceed(emailTrim);
        if (!ok) return;
      } finally {
        setCheckingSignupEmail(false);
      }
      setFieldErrors({});
      setError(null);
      setStep(2);
      return;
    }

    if (step === 2 && accountType === "premium") {
      if (!validateStep2()) return;
      setStep(3);
      return;
    }

    if (step === 2 && accountType === "free") {
      if (!validateStep2()) return;
      if (!validateStep1()) {
        setStep(1);
        return;
      }
      const emailTrim = formData.email.trim();
      const parsedAge = formData.age.trim() ? Number(formData.age) : null;
      setSubmitting(true);
      try {
        const available = await gateEmailAvailableBeforeProceed(emailTrim);
        if (!available) return;
        await signUp(emailTrim, formData.password, {
          name: formData.name.trim(),
          role: "free",
          interests,
          gender: formData.gender || null,
          age: parsedAge,
          location: formData.location.trim() || null,
        });
        try {
          const data = await getCurrentUserWithInterests();
          if (data) {
            setUser({
              id: data.profile.id,
              name: data.profile.name,
              email: data.profile.email,
              role: data.profile.role,
              avatar: data.profile.avatar ?? undefined,
              gender: data.profile.gender ?? undefined,
              age: data.profile.age ?? undefined,
              location: data.profile.location ?? undefined,
              interests: data.interests.length ? data.interests : undefined,
            });
          }
        } catch {
          /* email confirm flow */
        }
        navigate(`/verify-email?email=${encodeURIComponent(emailTrim)}`);
      } catch (err: unknown) {
        const dup = signupErrorIndicatesEmailTaken(err);
        const msg = getAuthErrorMessage(err, "Sign up failed. Please try again.");
        if (dup) {
          setFieldErrors((prev) => ({
            ...prev,
            email: SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
          }));
          setStep(1);
          setError("Please fix the highlighted fields below.");
        } else setError(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 3) {
      if (!validateStep3()) return;
      if (!validateStep2()) {
        setStep(2);
        return;
      }
      if (!validateStep1()) {
        setStep(1);
        return;
      }
      const emailTrim = formData.email.trim();
      const parsedAge = formData.age.trim() ? Number(formData.age) : null;
      setSubmitting(true);
      try {
        const available = await gateEmailAvailableBeforeProceed(emailTrim);
        if (!available) return;
        await signUp(emailTrim, formData.password, {
          name: formData.name.trim(),
          role: "premium",
          interests,
          gender: formData.gender || null,
          age: parsedAge,
          location: formData.location.trim() || null,
        });
        try {
          const data = await getCurrentUserWithInterests();
          if (data) {
            setUser({
              id: data.profile.id,
              name: data.profile.name,
              email: data.profile.email,
              role: data.profile.role,
              avatar: data.profile.avatar ?? undefined,
              gender: data.profile.gender ?? undefined,
              age: data.profile.age ?? undefined,
              location: data.profile.location ?? undefined,
              interests: data.interests.length ? data.interests : undefined,
            });
          }
        } catch {
          /* email confirm flow */
        }
        navigate(`/verify-email?email=${encodeURIComponent(emailTrim)}`);
      } catch (err: unknown) {
        const dup = signupErrorIndicatesEmailTaken(err);
        const msg = getAuthErrorMessage(err, "Sign up failed. Please try again.");
        if (dup) {
          setFieldErrors((prev) => ({
            ...prev,
            email: SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
          }));
          setStep(1);
          setError("Please fix the highlighted fields below.");
        } else setError(msg);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="border rounded-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">Create Account</h1>
          <p className="text-muted-foreground mb-6">
            Join our community of informed readers
          </p>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-red-600 text-white" : "bg-gray-200"}`}
              >
                1
              </div>
              <span className="text-sm">Account Info</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4">
              <div className={`h-full bg-red-600 transition-all ${step >= 2 ? "w-full" : "w-0"}`} />
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-red-600 text-white" : "bg-gray-200"}`}
              >
                2
              </div>
              <span className="text-sm">Select Interests</span>
            </div>
            {accountType === "premium" && (
              <>
                <div className="flex-1 h-1 bg-gray-200 mx-4">
                  <div className={`h-full bg-red-600 transition-all ${step >= 3 ? "w-full" : "w-0"}`} />
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-red-600 text-white" : "bg-gray-200"}`}
                  >
                    3
                  </div>
                  <span className="text-sm">Card details</span>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <form noValidate onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="signup-name">
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      clearField("name");
                      if (error?.includes("highlighted")) setError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.name))}`}
                    placeholder="Enter your name"
                    autoComplete="name"
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="signup-email">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      clearField("email");
                      if (error?.includes("highlighted")) setError(null);
                    }}
                    onBlur={() => {
                      const emailTrim = formData.email.trim();
                      if (!looksLikeEmail(emailTrim)) return;
                      setCheckingSignupEmail(true);
                      void (async () => {
                        try {
                          const taken = await checkSignupEmailTaken(emailTrim);
                          if (taken === true) remindEmailTaken();
                        } finally {
                          setCheckingSignupEmail(false);
                        }
                      })();
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.email))}`}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      clearField("password");
                      if (error?.includes("highlighted")) setError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.password))}`}
                    placeholder="Create a password"
                    autoComplete="new-password"
                  />
                  {fieldErrors.password && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="signup-confirm">
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value });
                      clearField("confirmPassword");
                      if (error?.includes("highlighted")) setError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.confirmPassword))}`}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="signup-gender">
                      Gender
                    </label>
                    <select
                      id="signup-gender"
                      value={formData.gender}
                      onChange={(e) => {
                        setFormData({ ...formData, gender: e.target.value });
                        clearField("gender");
                        if (error?.includes("highlighted")) setError(null);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-sm ${inputErrorClass(Boolean(fieldErrors.gender))}`}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                    {fieldErrors.gender && (
                      <p className="mt-1 text-sm text-destructive" role="alert">
                        {fieldErrors.gender}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="signup-age">
                      Age
                    </label>
                    <input
                      id="signup-age"
                      type="number"
                      min={13}
                      max={120}
                      value={formData.age}
                      onChange={(e) => {
                        setFormData({ ...formData, age: e.target.value });
                        clearField("age");
                        if (error?.includes("highlighted")) setError(null);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.age))}`}
                      placeholder="e.g. 28"
                    />
                    {fieldErrors.age && (
                      <p className="mt-1 text-sm text-destructive" role="alert">
                        {fieldErrors.age}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="signup-location">
                    Location
                  </label>
                  <input
                    id="signup-location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value });
                      clearField("location");
                      if (error?.includes("highlighted")) setError(null);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.location))}`}
                    placeholder="City, Country"
                    autoComplete="address-level1"
                  />
                  {fieldErrors.location && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {fieldErrors.location}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium">Account Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setAccountType("free")}
                      className={`p-4 border-2 rounded-lg text-left ${accountType === "free" ? "border-red-600 bg-red-50" : "border-gray-200"}`}
                    >
                      <h3 className="font-semibold mb-1">Free Account</h3>
                      <p className="text-sm text-muted-foreground">Access to basic features</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("premium")}
                      className={`p-4 border-2 rounded-lg text-left ${accountType === "premium" ? "border-red-600 bg-red-50" : "border-gray-200"}`}
                    >
                      <h3 className="font-semibold mb-1">
                        Premium Account
                        <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">
                          $9.99/mo
                        </span>
                      </h3>
                      <p className="text-sm text-muted-foreground">AI summaries, bookmarks & more</p>
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div>
                <h3 className="font-semibold mb-4">Select Your Interests</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose categories you&apos;re interested in to personalize your feed
                  {availableInterests.length > 0 ? " (at least one required)." : "."}
                </p>
                {fieldErrors.interests && (
                  <p className="mb-3 text-sm text-destructive" role="alert">
                    {fieldErrors.interests}
                  </p>
                )}
                <div className={`grid grid-cols-2 gap-3 rounded-lg ${fieldErrors.interests ? "p-3 ring-2 ring-red-600 ring-offset-2" : ""}`}>
                  {availableInterests.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleInterest(category.name)}
                      className={`p-3 border-2 rounded-lg text-left flex items-center justify-between ${
                        interests.includes(category.name)
                          ? "border-red-600 bg-red-50"
                          : "border-gray-200"
                      }`}
                    >
                      <span>{category.name}</span>
                      {interests.includes(category.name) && (
                        <Check className="w-5 h-5 text-red-600" aria-hidden />
                      )}
                    </button>
                  ))}
                </div>
                {availableInterests.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-3">No categories available yet.</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="font-semibold mb-2">Payment details</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter card details for verification. Numbers are validated before you can complete signup.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="signup-card-name">
                      Name on card
                    </label>
                    <input
                      id="signup-card-name"
                      type="text"
                      value={cardName}
                      onChange={(e) => {
                        setCardName(e.target.value);
                        clearField("cardName");
                        if (error?.includes("highlighted")) setError(null);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.cardName))}`}
                      placeholder="Name as shown on card"
                      autoComplete="cc-name"
                    />
                    {fieldErrors.cardName && (
                      <p className="mt-1 text-sm text-destructive" role="alert">
                        {fieldErrors.cardName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" htmlFor="signup-card-number">
                      Card number
                    </label>
                    <input
                      id="signup-card-number"
                      type="text"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => {
                        setCardNumber(formatCardNumber(e.target.value));
                        clearField("cardNumber");
                        if (error?.includes("highlighted")) setError(null);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.cardNumber))}`}
                      placeholder="1234 5678 9012 3456"
                      autoComplete="cc-number"
                    />
                    {fieldErrors.cardNumber && (
                      <p className="mt-1 text-sm text-destructive" role="alert">
                        {fieldErrors.cardNumber}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="signup-expiry">
                        Expiry (MM/YY)
                      </label>
                      <input
                        id="signup-expiry"
                        type="text"
                        inputMode="numeric"
                        value={expiry}
                        onChange={(e) => {
                          setExpiry(formatExpiry(e.target.value));
                          clearField("expiry");
                          if (error?.includes("highlighted")) setError(null);
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.expiry))}`}
                        placeholder="MM/YY"
                        autoComplete="cc-exp"
                      />
                      {fieldErrors.expiry && (
                        <p className="mt-1 text-sm text-destructive" role="alert">
                          {fieldErrors.expiry}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" htmlFor="signup-cvc">
                        CVV
                      </label>
                      <input
                        id="signup-cvc"
                        type="text"
                        inputMode="numeric"
                        value={cvc}
                        onChange={(e) => {
                          setCvc(digitsOnly(e.target.value).slice(0, 4));
                          clearField("cvc");
                          if (error?.includes("highlighted")) setError(null);
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 ${inputErrorClass(Boolean(fieldErrors.cvc))}`}
                        placeholder="123"
                        autoComplete="cc-csc"
                      />
                      {fieldErrors.cvc && (
                        <p className="mt-1 text-sm text-destructive" role="alert">
                          {fieldErrors.cvc}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Premium Subscription</span>
                      <span>$9.99/month</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>$9.99</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setStep(step - 1);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || checkingSignupEmail}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting || checkingSignupEmail
                  ? checkingSignupEmail && !submitting
                    ? "Checking email…"
                    : "Please wait…"
                  : step === 1
                    ? "Continue"
                    : step === 2 && accountType === "free"
                      ? "Create Account"
                      : step === 2
                        ? "Continue"
                        : "Complete Registration"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-red-600 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
