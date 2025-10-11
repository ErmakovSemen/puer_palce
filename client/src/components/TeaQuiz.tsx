import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

interface TeaQuizProps {
  onClose: () => void;
  onRecommend: (teaType: string) => void;
}

interface Question {
  id: number;
  text: string;
  options: {
    label: string;
    value: string;
  }[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "КАКОЙ ЭФФЕКТ ВЫ ХОТИТЕ ПОЛУЧИТЬ?",
    options: [
      { label: "Бодрость и энергию", value: "energize" },
      { label: "Спокойствие", value: "calm" },
      { label: "Концентрацию", value: "focus" },
    ],
  },
  {
    id: 2,
    text: "КАКОЙ ВКУС ВАМ БЛИЖЕ?",
    options: [
      { label: "Землистый и глубокий", value: "earthy" },
      { label: "Свежий и цветочный", value: "fresh" },
      { label: "Насыщенный выдержанный", value: "aged" },
    ],
  },
  {
    id: 3,
    text: "КОГДА ПЛАНИРУЕТЕ ПИТЬ ЧАЙ?",
    options: [
      { label: "Утром", value: "morning" },
      { label: "Днём", value: "day" },
      { label: "Вечером", value: "evening" },
    ],
  },
];

export default function TeaQuiz({ onClose, onRecommend }: TeaQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Логика подбора чая на основе ответов
      const recommendedType = getRecommendation(newAnswers);
      onRecommend(recommendedType);
      onClose();
    }
  };

  const getRecommendation = (userAnswers: string[]): string => {
    const [effect, taste, time] = userAnswers;
    
    // Простая логика рекомендаций
    if (effect === "energize" || effect === "focus") {
      if (taste === "earthy") return "Шу Пуэр";
      if (taste === "fresh") return "Шен Пуэр";
      return "Красный";
    }
    
    if (effect === "calm") {
      if (taste === "fresh") return "Шен Пуэр";
      return "Габа";
    }
    
    return "Шу Пуэр";
  };

  const question = questions[currentQuestion];

  return (
    <div className="relative">
      <div className="absolute top-0 right-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-quiz"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="pt-8 pb-6">
        <div className="flex justify-end mb-6">
          <span className="text-4xl font-bold text-muted-foreground" data-testid="text-quiz-progress">
            {currentQuestion + 1}/{questions.length}
          </span>
        </div>

        <h2 className="text-3xl font-bold mb-8" data-testid={`text-question-${currentQuestion}`}>
          {question.text}
        </h2>

        <div className="grid gap-4">
          {question.options.map((option, index) => (
            <Card
              key={index}
              className="p-8 hover-elevate active-elevate-2 cursor-pointer transition-all"
              onClick={() => handleAnswer(option.value)}
              data-testid={`button-option-${currentQuestion}-${index}`}
            >
              <p className="text-lg text-center font-medium">
                {option.label}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
