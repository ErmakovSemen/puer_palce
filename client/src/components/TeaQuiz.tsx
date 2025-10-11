import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import type { QuizConfig } from "@shared/schema";

interface TeaQuizProps {
  onClose: () => void;
  onRecommend: (teaType: string) => void;
}

export default function TeaQuiz({ onClose, onRecommend }: TeaQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const { data: quizConfig } = useQuery<QuizConfig>({
    queryKey: ["/api/quiz/config"],
  });

  if (!quizConfig) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentQuestion < quizConfig.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Логика подбора чая на основе ответов
      const recommendedType = getRecommendation(newAnswers, quizConfig);
      onRecommend(recommendedType);
      onClose();
    }
  };

  const getRecommendation = (userAnswers: string[], config: QuizConfig): string => {
    // Находим правило с наибольшим количеством совпадений
    let bestMatch = config.rules[0];
    let maxMatches = 0;

    for (const rule of config.rules) {
      const matches = rule.conditions.filter(cond => userAnswers.includes(cond)).length;
      
      // Правило подходит если:
      // - все его условия содержатся в ответах
      // - или это дефолтное правило (пустые условия)
      const isMatch = rule.conditions.length === 0 || 
                      (matches > 0 && matches >= rule.conditions.length);
      
      if (isMatch && matches > maxMatches) {
        maxMatches = matches;
        bestMatch = rule;
      }
    }
    
    return bestMatch.teaType;
  };

  const question = quizConfig.questions[currentQuestion];

  return (
    <div className="relative">
      <div className="pt-4 pb-6">
        <div className="flex justify-end mb-6">
          <span className="text-4xl font-bold text-muted-foreground" data-testid="text-quiz-progress">
            {currentQuestion + 1}/{quizConfig.questions.length}
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
