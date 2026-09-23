import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/api/category.api";
import { practiceApi } from "@/api/practice.api";
import { isApiError } from "@/api/httpClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  buildRangeChunks,
  DEFAULT_SETTINGS,
  flattenCategories,
  resolveSetup,
  type CategoryOption,
  type DisplayMode,
} from "./practiceModel";
import { savePracticeSession } from "./practiceSession";
import "./PracticeSetupPage.css";

const CHUNK_SIZES = [10, 20, 50, 100];

export function PracticeSetupPage() {
  const navigate = useNavigate();
  const publicCategories = useQuery({ queryKey: ["categories", "public"], queryFn: ({ signal }) => categoryApi.listPublic(signal) });
  const myCategories = useQuery({ queryKey: ["categories", "mine"], queryFn: ({ signal }) => categoryApi.listMine(signal) });

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [mode, setMode] = useState<"range" | "random">("range");
  const [chunkSize, setChunkSize] = useState(50);
  const [chunkIndex, setChunkIndex] = useState<number | null>(null);
  const [randomLimit, setRandomLimit] = useState("10");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(DEFAULT_SETTINGS.displayMode);
  const [showAnswer, setShowAnswer] = useState(DEFAULT_SETTINGS.showAnswer);
  const [shuffle, setShuffle] = useState(DEFAULT_SETTINGS.shuffle);
  const [shuffleAnswers, setShuffleAnswers] = useState(DEFAULT_SETTINGS.shuffleAnswers);
  const [formError, setFormError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const mine = flattenCategories(myCategories.data ?? []);
    const mineIds = new Set(mine.map((option) => option.id));
    const shared = flattenCategories(publicCategories.data ?? []).filter((option) => !mineIds.has(option.id));
    return { mine, shared };
  }, [publicCategories.data, myCategories.data]);

  const selected: CategoryOption | undefined = [...groups.mine, ...groups.shared].find((option) => option.id === categoryId);

  const count = useQuery({
    queryKey: ["practice", "count", categoryId],
    queryFn: ({ signal }) => practiceApi.count(categoryId as number, signal),
    enabled: categoryId !== null,
  });
  const total = count.data ?? 0;
  const chunks = useMemo(() => buildRangeChunks(total, chunkSize), [total, chunkSize]);

  const start = useMutation({
    mutationFn: async () => {
      const resolved = resolveSetup({
        mode,
        total,
        randomLimit: Number(randomLimit),
        chunkIndex,
        chunkSize,
      });
      if (!resolved.ok) throw new Error(resolved.error);
      if (categoryId === null) throw new Error("Vui lòng chọn một thư mục câu hỏi.");
      const response = await practiceApi.start({
        categoryId,
        limit: resolved.value.limit,
        offset: resolved.value.offset,
        isRandom: resolved.value.isRandom,
        forceNew: true,
      });
      return { response, resolved: resolved.value };
    },
    onSuccess: ({ response, resolved }) => {
      if (response.questions.length === 0 || response.practiceId === null) {
        setFormError("Không tìm thấy câu hỏi phù hợp với lựa chọn này.");
        return;
      }
      savePracticeSession({
        questions: response.questions,
        practiceId: response.practiceId,
        categoryId: response.categoryId ?? (categoryId as number),
        categoryName: response.categoryName ?? selected?.label ?? "",
        offset: resolved.offset,
        settings: { showAnswer, shuffle, shuffleAnswers, displayMode, isRandom: resolved.isRandom },
      });
      navigate("/student/practice/play");
    },
    onError: (error) => {
      setFormError(isApiError(error) ? error.message : error instanceof Error ? error.message : "Không thể bắt đầu luyện tập.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (categoryId === null) {
      setFormError("Vui lòng chọn thư mục câu hỏi trước.");
      return;
    }
    setFormError(null);
    start.mutate();
  }

  const categoriesLoading = publicCategories.isLoading || myCategories.isLoading;
  const categoriesFailed = publicCategories.isError && myCategories.isError;
  const noCategories = !categoriesLoading && groups.mine.length + groups.shared.length === 0;

  return (
    <div className="qh-practice-page">
      <section className="qh-practice-explorer">
        <div className="qh-practice-explorer__heading">
          <div>
            <span className="qh-practice-explorer__eyebrow">NGÂN HÀNG CÂU HỎI</span>
            <h1>Khám Phá Ngân Hàng Câu Hỏi</h1>
            <p>Chọn một thư mục, thiết lập cách học và bắt đầu luyện tập theo nhịp độ của bạn.</p>
          </div>
          <Link to="/student/history?tab=practice" className="qh-button qh-button--secondary">
            <i className="bi bi-clock-history" /> Lịch sử luyện tập
          </Link>
        </div>

      {categoriesLoading && <Spinner label="Đang tải thư mục câu hỏi" />}
      {categoriesFailed && (
        <ErrorState
          message="Không thể tải danh sách thư mục."
          onRetry={() => {
            void publicCategories.refetch();
            void myCategories.refetch();
          }}
        />
      )}
      {noCategories && !categoriesFailed && <EmptyState title="Chưa có thư mục câu hỏi nào" />}

      {!categoriesLoading && !categoriesFailed && !noCategories && (
        <Card className="qh-practice-settings">
          <div className="qh-practice-settings__title">
            <span><i className="bi bi-sliders" /></span>
            <div><h2>Thiết lập luyện tập</h2><p>Tùy chỉnh bộ câu hỏi trước khi bắt đầu</p></div>
          </div>
          <form onSubmit={handleSubmit} noValidate className="qh-practice-setup">
            {formError && (
              <p className="qh-practice-setup__error" role="alert">
                {formError}
              </p>
            )}

            <div className="qh-field">
              <label htmlFor="practice-category" className="qh-field__label">
                Thư mục câu hỏi
              </label>
              <select
                id="practice-category"
                className="qh-field__input"
                value={categoryId ?? ""}
                onChange={(event) => {
                  setCategoryId(event.target.value === "" ? null : Number(event.target.value));
                  setChunkIndex(null);
                  setFormError(null);
                }}
              >
                <option value="">Chọn một thư mục…</option>
                {groups.mine.length > 0 && (
                  <optgroup label="Thư mục của tôi">
                    {groups.mine.map((option) => (
                      <option key={`m-${option.id}`} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {groups.shared.length > 0 && (
                  <optgroup label="Thư mục công khai">
                    {groups.shared.map((option) => (
                      <option key={`p-${option.id}`} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {categoryId !== null && count.isLoading && <Spinner label="Đang đếm câu hỏi" />}
            {categoryId !== null && count.isError && (
              <ErrorState message="Không thể đếm câu hỏi trong thư mục này." onRetry={() => void count.refetch()} />
            )}
            {categoryId !== null && count.data !== undefined && total === 0 && (
              <EmptyState title="Thư mục này chưa có câu hỏi" description="Hãy chọn một thư mục khác." />
            )}

            {categoryId !== null && total > 0 && (
              <>
                <p className="qh-practice-setup__count" role="status">
                  <i className="bi bi-patch-question" /> Có {total} câu hỏi sẵn sàng
                </p>

                <fieldset className="qh-practice-setup__group">
                  <legend>Chọn câu hỏi</legend>
                  <label className="qh-practice-setup__choice">
                    <input type="radio" name="mode" checked={mode === "range"} onChange={() => setMode("range")} />
                    Theo thứ tự, chọn khoảng câu hỏi
                  </label>
                  <label className="qh-practice-setup__choice">
                    <input type="radio" name="mode" checked={mode === "random"} onChange={() => setMode("random")} />
                    Chọn ngẫu nhiên
                  </label>
                </fieldset>

                {mode === "range" ? (
                  <div className="qh-practice-setup__group">
                    <div className="qh-field">
                      <label htmlFor="practice-chunk-size" className="qh-field__label">
                        Số câu mỗi bộ
                      </label>
                      <select
                        id="practice-chunk-size"
                        className="qh-field__input"
                        value={chunkSize}
                        onChange={(event) => {
                          setChunkSize(Number(event.target.value));
                          setChunkIndex(null);
                        }}
                      >
                        {CHUNK_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div role="radiogroup" aria-label="Question range" className="qh-practice-setup__chunks">
                      {chunks.map((chunk, index) => (
                        <button
                          key={chunk.offset}
                          type="button"
                          role="radio"
                          aria-checked={chunkIndex === index}
                          className={`qh-practice-setup__chunk ${chunkIndex === index ? "qh-practice-setup__chunk--selected" : ""}`}
                          onClick={() => {
                            setChunkIndex(index);
                            setFormError(null);
                          }}
                        >
                          Câu {chunk.from}–{chunk.to}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Input
                    label={`Số lượng câu hỏi (1–${total})`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={total}
                    value={randomLimit}
                    onChange={(event) => setRandomLimit(event.target.value)}
                  />
                )}

                <fieldset className="qh-practice-setup__group">
                  <legend>Hình thức luyện tập</legend>
                  <label className="qh-practice-setup__choice">
                    <input type="radio" name="display" checked={displayMode === "sequential"} onChange={() => setDisplayMode("sequential")} />
                    Từng câu một
                  </label>
                  <label className="qh-practice-setup__choice">
                    <input type="radio" name="display" checked={displayMode === "all"} onChange={() => setDisplayMode("all")} />
                    Tất cả câu hỏi trên một trang
                  </label>
                  <label className="qh-practice-setup__choice">
                    <input type="radio" name="display" checked={displayMode === "flashcard"} onChange={() => setDisplayMode("flashcard")} />
                    Thẻ ghi nhớ (chỉ ôn tập, không tính điểm)
                  </label>
                </fieldset>

                <div className="qh-practice-setup__group">
                  <label className="qh-practice-setup__choice">
                    <input type="checkbox" checked={showAnswer} onChange={(event) => setShowAnswer(event.target.checked)} />
                    Hiện kết quả đúng/sai sau mỗi câu
                  </label>
                  <label className="qh-practice-setup__choice">
                    <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
                    Đảo thứ tự câu hỏi
                  </label>
                  <label className="qh-practice-setup__choice">
                    <input type="checkbox" checked={shuffleAnswers} onChange={(event) => setShuffleAnswers(event.target.checked)} />
                    Đảo thứ tự đáp án
                  </label>
                </div>

                <Button type="submit" isLoading={start.isPending}>
                  <i className="bi bi-play-fill" /> Bắt đầu luyện tập
                </Button>
              </>
            )}
          </form>
        </Card>
      )}
      </section>
    </div>
  );
}
