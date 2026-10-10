(() => {
  "use strict";

  const shell = document.querySelector(".app-shell");
  const welcomeScreen = document.getElementById("welcomeScreen");
  const signinScreen = document.getElementById("signinScreen");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const form = document.getElementById("signinForm");
  const formMessage = document.getElementById("formMessage");
  const togglePassword = document.getElementById("togglePassword");
  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = document.getElementById("soundLabel");
  const toast = document.getElementById("toast");
  const signInButton = document.getElementById("signInButton");
  let soundEnabled = false;
  let audioContext = null;
  let toastTimer = null;

  document.getElementById("year").textContent = String(new Date().getFullYear());

  function showSignin() {
    shell.classList.add("show-signin");
    welcomeScreen.setAttribute("aria-hidden", "true");
    welcomeScreen.inert = true;
    signinScreen.removeAttribute("aria-hidden");
    signinScreen.inert = false;
    window.setTimeout(() => username.focus({ preventScroll: true }), 250);
  }

  // Let the welcome greeting breathe for three seconds before the form arrives.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(showSignin, reducedMotion ? 150 : 3000);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3800);
  }

  togglePassword.addEventListener("click", () => {
    const reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    togglePassword.textContent = reveal ? "Hide" : "Show";
    togglePassword.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    password.focus({ preventScroll: true });
  });

  function playGreetingTune() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      showToast("This browser does not support the welcome tune.");
      return;
    }
    try {
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const notes = [
        { frequency: 523.25, at: 0, duration: 0.17 },
        { frequency: 659.25, at: 0.16, duration: 0.17 },
        { frequency: 783.99, at: 0.32, duration: 0.2 },
        { frequency: 1046.5, at: 0.54, duration: 0.32 }
      ];
      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = note.frequency;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + note.at);
        gain.gain.exponentialRampToValueAtTime(0.11, audioContext.currentTime + note.at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + note.at + note.duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime + note.at);
        oscillator.stop(audioContext.currentTime + note.at + note.duration + 0.03);
      });
    } catch (error) {
      console.warn("Welcome tune could not be played.", error);
      showToast("The welcome tune could not be played on this device.");
    }
  }

  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
    soundToggle.setAttribute("aria-label", soundEnabled ? "Turn welcome sound off" : "Turn welcome sound on");
    if (soundEnabled) {
      playGreetingTune();
      showToast("Welcome tune enabled.");
    } else if (audioContext && audioContext.state !== "closed") {
      audioContext.suspend();
    }
  });

  document.getElementById("forgotPassword").addEventListener("click", (event) => {
    event.preventDefault();
    showToast("Password recovery will be available after the ZakiTech authentication service is connected.");
  });

  document.getElementById("createAccount").addEventListener("click", () => {
    showToast("Account creation is the next setup step. Authentication is not connected yet.");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    const identity = username.value.trim();
    const secret = password.value;

    if (!identity) {
      formMessage.textContent = "Please enter your username or email.";
      username.focus();
      return;
    }
    if (!secret) {
      formMessage.textContent = "Please enter your password.";
      password.focus();
      return;
    }

    // Do not pretend to authenticate until a real, server-verified provider is configured.
    formMessage.textContent = "Sign-in is not connected yet. Your details have not been sent or saved. Authentication will be configured next.";
    showToast("The sign-in design is ready; secure authentication is the next step.");
  });
})();