/**
 * Bulk publish (UX-03-QA1 Finding 1): the EXISTING single-Question publish
 * endpoint once per id, sequentially. FUB-044: the first 401 stops the loop —
 * no more requests, unattempted ids are not counted as failed, nothing resumes
 * after sign-in (the Instructor retries explicitly).
 */
export async function publishQuestionsSequentially(
  courseId: string,
  ids: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<{ published: number; failed: number; sessionExpired: boolean }> {
  let published = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const response = await fetchFn(`/api/courses/${courseId}/questions/${id}/publish`, {
        method: "POST",
      });
      if (response.status === 401) return { published, failed, sessionExpired: true };
      if (response.ok) {
        published++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { published, failed, sessionExpired: false };
}
