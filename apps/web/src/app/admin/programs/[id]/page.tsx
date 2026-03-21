"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { adminApi, AdminProgram, UpdateProgramInput } from "@/lib/api";

const PROGRAM_TYPES = ["장학금", "정책", "대출", "주거", "취업", "기타"];
const REGIONS = ["부산", "대구", "서울", "경기", "인천", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

function toLocalDatetime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditProgramPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [program, setProgram] = useState<AdminProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateProgramInput>({});

  useEffect(() => {
    adminApi
      .getProgram(id)
      .then((p) => {
        setProgram(p);
        setForm({
          program_type: p.program_type,
          title: p.title,
          summary: p.summary ?? "",
          provider_name: p.provider_name ?? "",
          official_url: p.official_url ?? "",
          benefit_amount_monthly: p.benefit_amount_monthly ?? undefined,
          benefit_amount_semester: p.benefit_amount_semester ?? undefined,
          benefit_amount_once: p.benefit_amount_once ?? undefined,
          min_age: p.min_age ?? undefined,
          max_age: p.max_age ?? undefined,
          regions: p.regions ?? [],
          deadline_at: toLocalDatetime(p.deadline_at),
          application_start_at: toLocalDatetime(p.application_start_at),
          application_end_at: toLocalDatetime(p.application_end_at),
          is_active: p.is_active,
        });
      })
      .catch(() => setError("프로그램을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else if (["benefit_amount_monthly", "benefit_amount_semester", "benefit_amount_once", "min_age", "max_age"].includes(name)) {
      setForm((prev) => ({
        ...prev,
        [name]: value === "" ? undefined : Number(value),
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRegionToggle = (region: string) => {
    setForm((prev) => {
      const regions = prev.regions ?? [];
      return {
        ...prev,
        regions: regions.includes(region)
          ? regions.filter((r) => r !== region)
          : [...regions, region],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: UpdateProgramInput = {
        ...form,
        deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : undefined,
        application_start_at: form.application_start_at ? new Date(form.application_start_at).toISOString() : undefined,
        application_end_at: form.application_end_at ? new Date(form.application_end_at).toISOString() : undefined,
      };
      const updated = await adminApi.updateProgram(id, payload);
      setProgram(updated);
      setSuccess("저장되었습니다.");
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    setToggling(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminApi.togglePublish(id);
      setProgram((prev) => prev ? { ...prev, is_active: result.is_active } : prev);
      setForm((prev) => ({ ...prev, is_active: result.is_active }));
      setSuccess(result.is_active ? "활성화되었습니다." : "비활성화되었습니다.");
    } catch {
      setError("상태 변경에 실패했습니다.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>;
  if (error && !program) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">프로그램 편집</h1>
        <button onClick={handleTogglePublish} disabled={toggling}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            program?.is_active
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}>
          {toggling ? "처리 중..." : program?.is_active ? "비활성화" : "활성화"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
          <input name="title" value={form.title ?? ""} onChange={handleChange} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
          <select name="program_type" value={form.program_type ?? ""} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PROGRAM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">요약</label>
          <textarea name="summary" value={form.summary ?? ""} onChange={handleChange} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제공 기관</label>
          <input name="provider_name" value={form.provider_name ?? ""} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">공식 URL</label>
          <input name="official_url" value={form.official_url ?? ""} onChange={handleChange} type="url"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">월 지원금 (원)</label>
            <input name="benefit_amount_monthly" type="number" value={form.benefit_amount_monthly ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학기 지원금 (원)</label>
            <input name="benefit_amount_semester" type="number" value={form.benefit_amount_semester ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">일시 지원금 (원)</label>
            <input name="benefit_amount_once" type="number" value={form.benefit_amount_once ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최소 나이</label>
            <input name="min_age" type="number" value={form.min_age ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 나이</label>
            <input name="max_age" type="number" value={form.max_age ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => (
              <button type="button" key={r} onClick={() => handleRegionToggle(r)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  form.regions?.includes(r)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">마감일</label>
          <input name="deadline_at" type="datetime-local" value={form.deadline_at ?? ""} onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">신청 시작일</label>
            <input name="application_start_at" type="datetime-local" value={form.application_start_at ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">신청 종료일</label>
            <input name="application_end_at" type="datetime-local" value={form.application_end_at ?? ""} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/admin/programs")}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            목록으로
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
