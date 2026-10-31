(() => {
  "use strict";

  // ---------------------------------------------------------
  // Backend Configuration:
  // Deployed FastAPI backend. Change this to
  // http://127.0.0.1:8000 when testing against your local API.
  // ---------------------------------------------------------
  const API_BASE = "https://mental-health-score-kc9n.onrender.com";

  // DOM Elements
  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreMaxEl = document.getElementById("score-max");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");
  const errorLabelEl = document.getElementById("error-label");
  const errorCopyEl = document.getElementById("error-copy");

  const GAUGE_ARC_LENGTH = 314; // approx pi * r(100)

  // ---------------------------------------------------------
  // Draw tick marks on both idle & result gauges
  // ---------------------------------------------------------
  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((g) => {
      g.innerHTML = "";
      const cx = 120, cy = 140, rOuter = 100, rInner = 90;
      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI; // 180deg -> 0deg
        const x1 = cx + rOuter * Math.cos(angle);
        const y1 = cy - rOuter * Math.sin(angle);
        const x2 = cx + rInner * Math.cos(angle);
        const y2 = cy - rInner * Math.sin(angle);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        g.appendChild(line);
      }
    });
  }
  drawTicks();

  // ---------------------------------------------------------
  // Segmented control (stress_level) wiring
  // ---------------------------------------------------------
  const segGroup = document.getElementById("stress_level_group");
  const stressHiddenInput = document.getElementById("stress_level");
  if (segGroup && stressHiddenInput) {
    segGroup.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        segGroup.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        stressHiddenInput.value = btn.dataset.value;
        clearFieldError(stressHiddenInput);
      });
    });
  }

  // ---------------------------------------------------------
  // Field-level error helpers
  // ---------------------------------------------------------
  function fieldWrapper(input) {
    return input ? input.closest(".field") : null;
  }

  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }

  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------------------------------------------------------
  // Client-side validation mirroring backend constraints
  // ---------------------------------------------------------
  function validate(payload) {
    const errors = [];

    const numericChecks = [
      ["age", 10, 100],
      ["avg_daily_usage_hours", 0, 24],
      ["daily_unlocks", 0, Infinity],
      ["study_hours", 0, 24],
      ["physical_activity_hours", 0, 24],
      ["sleep_hours_per_night", 0, 24],
    ];

    numericChecks.forEach(([key, min, max]) => {
      const input = document.getElementById(key);
      const val = payload[key];
      if (val === "" || val === null || Number.isNaN(val)) {
        errors.push([input, "This field is required."]);
      } else if (val < min || val > max) {
        errors.push([input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
      }
    });

    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use"].forEach((key) => {
      const input = document.getElementById(key);
      if (!payload[key] || String(payload[key]).trim() === "") {
        errors.push([input, "This field is required."]);
      }
    });

    if (!payload.stress_level) {
      errors.push([stressHiddenInput, "Pick a stress level."]);
    }

    return errors;
  }

  // ---------------------------------------------------------
  // Gather form data into exact backend shape
  // Supports both Capitalized keys (Pydantic model in main.py)
  // and lowercase aliases for maximum compatibility.
  // ---------------------------------------------------------
  function collectPayload() {
    const fd = new FormData(form);

    const ageVal = fd.get("age") === "" ? NaN : parseInt(fd.get("age"), 10);
    const genderVal = fd.get("gender") || "";
    const countryVal = (fd.get("country") || "").trim();
    const academicVal = fd.get("academic_level") || "";
    const platformVal = fd.get("most_used_platform") || "";
    const purposeVal = fd.get("purpose_of_use") || "";
    const usageVal = fd.get("avg_daily_usage_hours") === "" ? NaN : parseFloat(fd.get("avg_daily_usage_hours"));
    const unlocksVal = fd.get("daily_unlocks") === "" ? NaN : parseInt(fd.get("daily_unlocks"), 10);
    const studyVal = fd.get("study_hours") === "" ? NaN : parseFloat(fd.get("study_hours"));
    const physicalVal = fd.get("physical_activity_hours") === "" ? NaN : parseFloat(fd.get("physical_activity_hours"));
    const sleepVal = fd.get("sleep_hours_per_night") === "" ? NaN : parseFloat(fd.get("sleep_hours_per_night"));
    const stressVal = fd.get("stress_level") || "";

    return {
      // Exact Pydantic model keys expected by main.py
      Age: ageVal,
      Gender: genderVal,
      Country: countryVal,
      Academic_Level: academicVal,
      Most_Used_Platform: platformVal,
      Purpose_Of_Use: purposeVal,
      Avg_Daily_Usage_Hours: usageVal,
      Daily_Unlocks: unlocksVal,
      Study_Hours: studyVal,
      Physical_Activity_Hours: physicalVal,
      Sleep_Hours_Per_Night: sleepVal,
      Stress_Level: stressVal,

      // Lowercase aliases for client-side validation & alternate schemas
      age: ageVal,
      gender: genderVal,
      country: countryVal,
      academic_level: academicVal,
      most_used_platform: platformVal,
      purpose_of_use: purposeVal,
      avg_daily_usage_hours: usageVal,
      daily_unlocks: unlocksVal,
      study_hours: studyVal,
      physical_activity_hours: physicalVal,
      sleep_hours_per_night: sleepVal,
      stress_level: stressVal,
    };
  }

  // ---------------------------------------------------------
  // UI state switching
  // ---------------------------------------------------------
  function showState(name) {
    [stateIdle, stateLoading, stateResult, stateError].forEach((el) => {
      if (el) el.hidden = true;
    });
    const target = { idle: stateIdle, loading: stateLoading, result: stateResult, error: stateError }[name];
    if (target) target.hidden = false;
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.classList.toggle("loading", isSubmitting);
  }

  function bandFor(normalizedScore) {
    // normalizedScore is mapped on a 0-10 scale
    if (normalizedScore < 4) {
      return {
        label: "Signal: strained",
        context: "Your responses suggest elevated strain right now. Small shifts in sleep or screen time can go a long way.",
      };
    }
    if (normalizedScore < 7) {
      return {
        label: "Signal: balanced",
        context: "Your rhythm looks fairly steady, with some room to recover and reset.",
      };
    }
    return {
      label: "Signal: strong",
      context: "Your habits point to a well-supported, resilient baseline. Keep it up.",
    };
  }

  function renderResult(score) {
    // Adapt dynamically whether backend returns a 0-10 or 0-100 score (e.g. 72)
    const isScale100 = score > 10;
    const maxVal = isScale100 ? 100 : 10;
    const normalized = isScale100 ? score / 10 : score;
    const clamped = Math.max(0, Math.min(maxVal, score));

    const { label, context } = bandFor(normalized);

    if (scoreNumberEl) {
      scoreNumberEl.textContent = isScale100 ? Math.round(score).toString() : score.toFixed(1);
    }
    if (scoreMaxEl) {
      scoreMaxEl.textContent = isScale100 ? "/100" : "/10";
    }
    if (scoreBandEl) {
      scoreBandEl.textContent = label;
    }
    if (scoreContextEl) {
      scoreContextEl.textContent = context;
    }

    // Reset and animate the gauge arc fill
    if (gaugeFill) {
      gaugeFill.style.transition = "none";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
      requestAnimationFrame(() => {
        gaugeFill.style.transition = "";
        const offset = GAUGE_ARC_LENGTH * (1 - clamped / maxVal);
        gaugeFill.style.strokeDashoffset = String(offset);
      });
    }

    showState("result");
  }

  function renderError(label, copy) {
    if (errorLabelEl) errorLabelEl.textContent = label;
    if (errorCopyEl) errorCopyEl.textContent = copy;
    showState("error");
  }

  // ---------------------------------------------------------
  // Parse FastAPI / Pydantic 422 error responses into
  // field-level messages where possible
  // ---------------------------------------------------------
  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const rawField = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      if (!rawField) return;
      const fieldId = String(rawField).toLowerCase();
      const input = document.getElementById(fieldId);
      const target = fieldId === "stress_level" ? stressHiddenInput : input;
      if (target) {
        setFieldError(target, err.msg || "Invalid value.");
        matched = true;
      }
    });
    return matched;
  }

  // ---------------------------------------------------------
  // Form Submit Handler
  // ---------------------------------------------------------
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAllErrors();

      const payload = collectPayload();
      const clientErrors = validate(payload);

      if (clientErrors.length > 0) {
        clientErrors.forEach(([input, msg]) => input && setFieldError(input, msg));
        clientErrors[0][0]?.focus?.();
        return;
      }

      setSubmitting(true);
      showState("loading");

      try {
        const res = await fetch(`${API_BASE}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 422) {
          const body = await res.json().catch(() => null);
          const matched = body && applyServerValidationErrors(body.detail);
          renderError(
            "Check your inputs",
            matched
              ? "The API rejected a few fields — details are marked on the form."
              : "The API rejected this submission. Please review your inputs and try again."
          );
          return;
        }

        if (!res.ok) {
          let detailMsg = `The API responded with status ${res.status}.`;
          const body = await res.json().catch(() => null);
          if (body && typeof body.detail === "string") detailMsg = body.detail;
          renderError("Prediction failed", detailMsg);
          return;
        }

        const data = await res.json();
        const scoreVal = data.predicted_mental_health_score;

        if (typeof scoreVal !== "number" || !Number.isFinite(scoreVal)) {
          renderError("Unexpected response", "The API responded, but 'predicted_mental_health_score' was missing or malformed.");
          return;
        }

        renderResult(scoreVal);
      } catch (err) {
        console.error("API error:", err);
        renderError(
          "Can't reach the server",
          `Couldn't connect to ${API_BASE}. Make sure your FastAPI backend is running ('uvicorn main:app --reload') and that CORS is enabled in main.py.`
        );
      } finally {
        setSubmitting(false);
      }
    });

    // Live-clear field errors as the user edits
    form.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", () => clearFieldError(el));
      el.addEventListener("change", () => clearFieldError(el));
    });
  }

  function returnToIdle() {
    clearAllErrors();
    showState("idle");
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", returnToIdle);
  }

  if (errorRetryBtn) {
    errorRetryBtn.addEventListener("click", returnToIdle);
  }
})();
