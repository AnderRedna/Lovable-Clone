"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Code2,
  Cloud,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import emailjs from "emailjs-com";
import "./feedback-form.css";

type Seniority = "Junior" | "Pleno" | "Senior";
// HTML, CSS, JS are a single combined format
type OutputPref = "HTML/CSS/JS" | "Next.js" | "Outro";
type HostingPref = "Vercel" | "Netlify" | "Outro";

const STORAGE_KEY = "techFeedback";

const TechFeedbackForm: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({
    seniority: "" as "" | Seniority,
    output: "" as "" | OutputPref,
    outputOutro: "",
    hosting: "" as "" | HostingPref,
    hostingOutro: "",
    comments: "",
  });

  // Steps configuration similar to FeedbackForm
  const steps = [
    {
      key: "seniority",
      label: "Qual seu nível de senioridade?",
      options: [
        { value: "Junior", icon: Briefcase, label: "Junior" },
        { value: "Pleno", icon: Briefcase, label: "Pleno" },
        { value: "Senior", icon: Briefcase, label: "Senior" },
      ],
    },
    {
      key: "output",
      label: "Qual output prefere?",
      options: [
        { value: "HTML/CSS/JS", icon: Code2, label: "HTML/CSS/JS" },
        { value: "Next.js", icon: Code2, label: "Next.js" },
        { value: "Outro", icon: Code2, label: "Outro" },
      ],
    },
    {
      key: "hosting",
      label: "Qual hospedagem automática prefere?",
      options: [
        { value: "Vercel", icon: Cloud, label: "Vercel" },
        { value: "Netlify", icon: Cloud, label: "Netlify" },
        { value: "Outro", icon: Cloud, label: "Outro" },
      ],
    },
    {
      key: "comments",
      label: "Algum comentário adicional?",
      type: "textarea" as const,
    },
  ];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.submitted) {
          setSubmitted(true);
        } else if (parsed?.data) {
          setData(parsed.data);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data, submitted })
      );
    } catch {}
  }, [data, submitted]);

  const isStepValid = useMemo(() => {
    const step = steps[currentStep];
    if (!step) return false;

    if (step.key === "seniority") return Boolean(data.seniority);

    if (step.key === "output") {
      if (!data.output) return false;
      if (data.output === "Outro") return data.outputOutro.trim().length > 0;
      return true;
    }

    if (step.key === "hosting") {
      if (!data.hosting) return false;
      if (data.hosting === "Outro") return data.hostingOutro.trim().length > 0;
      return true;
    }

    if (step.key === "comments") return true; // optional

    return false;
  }, [steps, currentStep, data]);

  const isAllValid = useMemo(() => {
    const outputOk = data.output && (data.output !== "Outro" || data.outputOutro.trim().length > 0);
    const hostingOk = data.hosting && (data.hosting !== "Outro" || data.hostingOutro.trim().length > 0);
    return Boolean(data.seniority && outputOk && hostingOk);
  }, [data]);
  const resetForm = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSubmitted(false);
    setCurrentStep(0);
    setData({ seniority: "", output: "", outputOutro: "", hosting: "", hostingOutro: "", comments: "" });
  };

  const handleSelect = (fieldKey: string, value: string) => {
    setData((prev) => ({ ...prev, [fieldKey]: value } as typeof prev));
    if (currentStep < steps.length - 1 && value !== "Outro") {
      setTimeout(() => setCurrentStep((s) => s + 1), 200);
    }
  };

  const renderStep = () => {
    const step = steps[currentStep];
    if (!step) return null;

    if (step.options) {
      // Special handling for Outro
      if (step.key === "output" && data.output === "Outro") {
        return (
          <div className="outros-container">
            <input
              type="text"
              value={data.outputOutro}
              onChange={(e) => setData((p) => ({ ...p, outputOutro: e.target.value }))}
              placeholder="Descreva o formato de saída desejado"
              className="outros-input"
            />
            <div className="button-group">
              <button
                type="button"
                className="back-btn"
                onClick={() => setData((p) => ({ ...p, output: "", outputOutro: "" }))}
              >
                <ArrowLeft />
                Voltar
              </button>
              <button
                type="button"
                className="next-btn"
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!data.outputOutro.trim()}
              >
                Avançar <ChevronRight />
              </button>
            </div>
          </div>
        );
      }

      if (step.key === "hosting" && data.hosting === "Outro") {
        return (
          <div className="outros-container">
            <input
              type="text"
              value={data.hostingOutro}
              onChange={(e) => setData((p) => ({ ...p, hostingOutro: e.target.value }))}
              placeholder="Qual serviço de hospedagem?"
              className="outros-input"
            />
            <div className="button-group">
              <button
                type="button"
                className="back-btn"
                onClick={() => setData((p) => ({ ...p, hosting: "", hostingOutro: "" }))}
              >
                <ArrowLeft />
                Voltar
              </button>
              <button
                type="button"
                className="next-btn"
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!data.hostingOutro.trim()}
              >
                Avançar <ChevronRight />
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="options">
          {step.options.map((option) => {
            const Icon = option.icon;
            const selected = (data as any)[step.key] === option.value;
            return (
              <div
                key={option.value}
                className={`option ${selected ? "selected" : ""}`}
                onClick={() => handleSelect(step.key, option.value)}
              >
                <Icon />
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (step.type === "textarea") {
      return (
        <textarea
          value={data.comments}
          onChange={(e) => setData((p) => ({ ...p, comments: e.target.value }))}
          rows={3}
          placeholder="Opcional"
          className="textarea"
        />
      );
    }

    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAllValid) return;

    try {
      const serviceID = "service_zwwobvo";
  const templateID = "template_10r24so";
      const userID = "RuBHi5GC3zvTQyvmJ";

      const templateParams = {
        to_email: "andertonmayk@gmail.com",
        seniority: data.seniority,
        output:
          data.output === "Outro" ? `${data.output} - ${data.outputOutro}` : data.output,
        hosting:
          data.hosting === "Outro" ? `${data.hosting} - ${data.hostingOutro}` : data.hosting,
        comments: data.comments,
      } as Record<string, string>;

      await emailjs.send(serviceID, templateID, templateParams, userID);
    } catch (err) {
      console.error("Failed to send tech feedback via emailjs", err);
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="feedback-container thank-you">
        <h2>Feedback enviado. Obrigado!</h2>
        <div className="button-group" style={{ marginTop: 12 }}>
          <button type="button" className="next-btn" onClick={resetForm}>
            Enviar novo feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-container" style={{ marginBottom: 12 }}>
      <div className="step-container" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Briefcase />
          <h3 className="step-label" style={{ margin: 0 }}>Questionário técnico</h3>
        </div>

        <div className="progress-bar">
          <div
            className="progress"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="step-container">
            <h3 className="step-label">{steps[currentStep].label}</h3>
            {renderStep()}
            {currentStep > 0 &&
              currentStep < steps.length - 1 &&
              !(
                (steps[currentStep].key === "output" && data.output === "Outro") ||
                (steps[currentStep].key === "hosting" && data.hosting === "Outro")
              ) && (
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setCurrentStep((s) => s - 1)}
                >
                  <ArrowLeft />
                  Voltar
                </button>
              )}
            {currentStep === steps.length - 1 && (
              <div className="button-group">
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setCurrentStep((s) => s - 1)}
                >
                  <ArrowLeft />
                  Voltar
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!isAllValid}
                >
                  Salvar <ChevronRight />
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Removed generic advance button; options click auto-advances */}
      </div>
    </div>
  );
};

export default TechFeedbackForm;
