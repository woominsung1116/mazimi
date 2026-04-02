/**
 * lib/vault.ts — Shared vault types and data hook
 *
 * Single source of truth for StoredDocument / DocumentType used across
 * auto-fill.tsx, apply-assistant.tsx, and document-vault.tsx.
 */

import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VAULT_STORAGE_KEY = "document_vault_v1";

// ---------------------------------------------------------------------------
// Types (canonical — document-vault.tsx re-exports these)
// ---------------------------------------------------------------------------

export type DocumentType =
  | "resident_register"   // 주민등록등본
  | "income_proof"        // 소득증명원
  | "enrollment_cert"     // 재학증명서
  | "leave_cert"          // 휴학증명서
  | "graduation_cert"     // 졸업증명서
  | "health_insurance"    // 건강보험료 납부확인서
  | "family_relation"     // 가족관계증명서
  | "bank_statement"      // 통장사본
  | "disability_cert"     // 장애인증명서
  | "other";              // 기타

export interface StoredDocument {
  id: string;
  type: DocumentType;
  name: string;
  /** Local file URI (expo-file-system copy) — null if metadata-only */
  fileUri: string | null;
  /** MIME type of the stored file */
  mimeType: string | null;
  /** ISO date string */
  issuedAt: string;
  /** ISO date string — null if no explicit expiry */
  expiresAt: string | null;
  /** ISO date string of when this entry was added to the vault */
  addedAt: string;
  note: string | null;
  /** Whether the stored file has been AES-256-CBC encrypted with the user's derived key. */
  encrypted: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** 보관함 서류 목록을 TanStack Query로 캐싱하여 반환한다. */
export function useVaultDocuments(): StoredDocument[] {
  const { data = [] } = useQuery({
    queryKey: ["vault-documents"],
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(VAULT_STORAGE_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as StoredDocument[]) : [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
  return data;
}
