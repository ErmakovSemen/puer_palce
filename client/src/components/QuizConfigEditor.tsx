import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, MoveUp, MoveDown } from "lucide-react";
import type { QuizQuestion, QuizRecommendationRule, QuizConfig } from "@shared/schema";

interface QuizConfigEditorProps {
  config: QuizConfig;
  onSave: (config: QuizConfig) => void;
}

export default function QuizConfigEditor({ config, onSave }: QuizConfigEditorProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(config.questions);
  const [rules, setRules] = useState<QuizRecommendationRule[]>(config.rules);

  const handleSave = () => {
    onSave({ questions, rules });
  };

  // Questions management
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q${questions.length + 1}`,
        text: "",
        options: [
          { label: "", value: "" },
          { label: "", value: "" },
        ],
      },
    ]);
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const deleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addOption = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options.push({ label: "", value: "" });
    setQuestions(updated);
  };

  const updateOption = (questionIndex: number, optionIndex: number, field: "label" | "value", value: string) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex][field] = value;
    setQuestions(updated);
  };

  const deleteOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options = updated[questionIndex].options.filter((_, i) => i !== optionIndex);
    setQuestions(updated);
  };

  // Rules management
  const addRule = () => {
    setRules([
      ...rules,
      {
        conditions: [],
        teaType: "",
        priority: rules.length + 1,
      },
    ]);
  };

  const updateRule = (index: number, field: keyof QuizRecommendationRule, value: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const moveRule = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;

    const updated = [...rules];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setRules(updated);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="questions">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="questions" data-testid="tab-questions">Вопросы</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Правила рекомендаций</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4 mt-4">
          {questions.map((question, qIndex) => (
            <Card key={qIndex} className="p-4" data-testid={`quiz-question-${qIndex}`}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label>Вопрос {qIndex + 1}</Label>
                    <Input
                      value={question.text}
                      onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
                      placeholder="Введите текст вопроса"
                      data-testid={`input-question-text-${qIndex}`}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteQuestion(qIndex)}
                    data-testid={`button-delete-question-${qIndex}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Варианты ответов</Label>
                  {question.options.map((option, oIndex) => (
                    <div key={oIndex} className="flex gap-2" data-testid={`quiz-option-${qIndex}-${oIndex}`}>
                      <Input
                        placeholder="Текст ответа"
                        value={option.label}
                        onChange={(e) => updateOption(qIndex, oIndex, "label", e.target.value)}
                        data-testid={`input-option-label-${qIndex}-${oIndex}`}
                      />
                      <Input
                        placeholder="Значение"
                        value={option.value}
                        onChange={(e) => updateOption(qIndex, oIndex, "value", e.target.value)}
                        data-testid={`input-option-value-${qIndex}-${oIndex}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteOption(qIndex, oIndex)}
                        data-testid={`button-delete-option-${qIndex}-${oIndex}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOption(qIndex)}
                    data-testid={`button-add-option-${qIndex}`}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить вариант
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          <Button onClick={addQuestion} data-testid="button-add-question">
            <Plus className="w-4 h-4 mr-2" />
            Добавить вопрос
          </Button>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground mb-4">
            Правила применяются в порядке приоритета. Чем выше правило в списке, тем выше его приоритет.
          </div>
          
          {rules.map((rule, rIndex) => (
            <Card key={rIndex} className="p-4" data-testid={`quiz-rule-${rIndex}`}>
              <div className="flex gap-4">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => moveRule(rIndex, "up")}
                    disabled={rIndex === 0}
                    data-testid={`button-move-rule-up-${rIndex}`}
                  >
                    <MoveUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => moveRule(rIndex, "down")}
                    disabled={rIndex === rules.length - 1}
                    data-testid={`button-move-rule-down-${rIndex}`}
                  >
                    <MoveDown className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <Label>Условия (значения из ответов, через запятую)</Label>
                    <Input
                      value={rule.conditions.join(", ")}
                      onChange={(e) => updateRule(rIndex, "conditions", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder="energize, earthy"
                      data-testid={`input-rule-conditions-${rIndex}`}
                    />
                  </div>

                  <div>
                    <Label>Рекомендуемый тип чая</Label>
                    <Input
                      value={rule.teaType}
                      onChange={(e) => updateRule(rIndex, "teaType", e.target.value)}
                      placeholder="Шу Пуэр"
                      data-testid={`input-rule-teatype-${rIndex}`}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => deleteRule(rIndex)}
                  data-testid={`button-delete-rule-${rIndex}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          <Button onClick={addRule} data-testid="button-add-rule">
            <Plus className="w-4 h-4 mr-2" />
            Добавить правило
          </Button>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-quiz-config">
          Сохранить конфигурацию
        </Button>
      </div>
    </div>
  );
}
