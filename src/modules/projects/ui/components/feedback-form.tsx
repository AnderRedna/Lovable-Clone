"use client";

import React, { useEffect, useState } from "react";
import { Star, MessageCircle, Linkedin, Users, MoreHorizontal, ChevronRight, ArrowLeft, Check, X } from "lucide-react";
import emailjs from "emailjs-com";
import "./feedback-form.css";

const STORAGE_KEY = "generalFeedback";

const FeedbackForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    heardFrom: "",
    experience: "",
    recommend: "",
    suggestions: "",
    outrosText: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const resetForm = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSubmitted(false);
    setCurrentStep(0);
    setFormData({ heardFrom: "", experience: "", recommend: "", suggestions: "", outrosText: "" });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.submitted) {
          setSubmitted(true);
        } else if (parsed?.data) {
          setFormData(parsed.data);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data: formData, submitted })
      );
    } catch {}
  }, [formData, submitted]);

  const steps = [
    {
      key: "heardFrom",
      label: "Onde ouviu falar de mim?",
      options: [
        { value: "Discord", icon: MessageCircle, label: "Discord" },
        { value: "LinkedIn", icon: Linkedin, label: "LinkedIn" },
        { value: "Amigos", icon: Users, label: "Amigos" },
        { value: "Outros", icon: MoreHorizontal, label: "Outros" },
      ],
    },
    {
      key: "experience",
      label: "Como está sendo sua experiência?",
      type: "stars",
    },
    {
      key: "recommend",
      label: "Recomendaria pra um amigo?",
      options: [
          { value: "Não", icon: X, label: "Não" },
          { value: "Sim", icon: Check, label: "Sim" },
      ],
    },
    {
      key: "suggestions",
      label: "Tem alguma sugestão?",
      type: "textarea",
    },
  ];

  const handleSelect = (value: string) => {
    setFormData({ ...formData, [steps[currentStep].key]: value });
    if (currentStep < steps.length - 1 && value !== "Outros") {
      setTimeout(() => setCurrentStep(currentStep + 1), 300); // Delay for animation
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // EmailJS configuration (replace with your actual IDs from https://www.emailjs.com/)
    const serviceID = "service_zwwobvo";
    const templateID = "template_ebbd32j";
    const userID = "RuBHi5GC3zvTQyvmJ"

    const templateParams = {
      to_email: "andertonmayk@gmail.com",
      heard_from: formData.heardFrom === "Outros" ? `Outros: ${formData.outrosText}` : formData.heardFrom,
      experience: formData.experience,
      recommend: formData.recommend,
      suggestions: formData.suggestions,
    };

    emailjs.send(serviceID, templateID, templateParams, userID)
      .then((response) => {
        console.log("Email sent successfully!", response.status, response.text);
        setSubmitted(true);
      })
      .catch((error) => {
        console.error("Failed to send email:", error);
        alert("Erro ao enviar feedback. Tente novamente.");
      });
  };

  const renderStars = (field: string, value: string) => {
    return (
      <div className="stars">
        {[1, 2, 3, 4, 5].map((num) => (
          <Star
            key={num}
            className={`star ${parseInt(value) >= num ? "filled" : ""}`}
            onClick={() => handleSelect(num.toString())}
          />
        ))}
      </div>
    );
  };

  const renderStep = () => {
    const step = steps[currentStep];
    return (
      <div className="step-container">
        <h3 className="step-label">{step.label}</h3>
        {step.options ? (
          formData.heardFrom === "Outros" ? (
            <div className="outros-container">
              <input
                type="text"
                value={formData.outrosText}
                onChange={(e) => setFormData({ ...formData, outrosText: e.target.value })}
                placeholder="Por favor, especifique..."
                className="outros-input"
              />
              <div className="button-group">
                <button type="button" className="back-btn" onClick={() => setFormData({ ...formData, heardFrom: "", outrosText: "" })}>
                  <ArrowLeft />
                  Voltar
                </button>
                <button type="button" className="next-btn" onClick={() => setCurrentStep(currentStep + 1)}>
                  Avançar <ChevronRight />
                </button>
              </div>
            </div>
          ) : (
            <div className="options">
              {step.options.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`option ${formData[step.key as keyof typeof formData] === option.value ? "selected" : ""}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    <Icon />
                    <span>{option.label}</span>
                  </div>
                );
              })}
            </div>
          )
        ) : step.type === "stars" ? (
          renderStars(step.key, formData[step.key as keyof typeof formData] as string)
        ) : (
          <textarea
            value={formData.suggestions}
            onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
            rows={4}
            placeholder="Digite suas sugestões aqui..."
            className="textarea"
          />
        )}
        {currentStep > 0 && currentStep < steps.length - 1 && (
          <button type="button" className="back-btn" onClick={() => setCurrentStep(currentStep - 1)}>
            <ArrowLeft />
            Voltar
          </button>
        )}
        {currentStep === steps.length - 1 && (
          <div className="button-group">
            <button type="button" className="back-btn" onClick={() => setCurrentStep(currentStep - 1)}>
              <ArrowLeft />
              Voltar
            </button>
            <button type="submit" className="submit-btn">
              Avançar <ChevronRight />
            </button>
          </div>
        )}
      </div>
    );
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
    <div className="feedback-container">
      {/* <h2>Responda e ganhe créditos!</h2> */}
      <div className="progress-bar">
        <div className="progress" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
      </div>
      <form onSubmit={handleSubmit} className="feedback-form">
        {renderStep()}
      </form>
    </div>
  );
};

export default FeedbackForm;
