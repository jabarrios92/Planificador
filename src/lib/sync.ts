import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserTopicProgress, ReviewEvent } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

/**
 * Robust error handler conforming strictly to Phase 3 of firebase-integration guidelines.
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error Detailed Informative Package: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Memory / Local Storage keys
const LOCAL_PROGRESS_KEY = 'udla_residencia_progress';
const LOCAL_REVIEWS_KEY = 'udla_residencia_reviews';

/**
 * LocalStorage Fallbacks
 */
export function getLocalProgress(): Record<string, UserTopicProgress> {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read local progress:', e);
    return {};
  }
}

export function saveLocalProgress(progress: Record<string, UserTopicProgress>) {
  try {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to write local progress:', e);
  }
}

export function getLocalReviews(): ReviewEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read local reviews:', e);
    return [];
  }
}

export function saveLocalReviews(reviews: ReviewEvent[]) {
  try {
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(reviews));
  } catch (e) {
    console.error('Failed to write local reviews:', e);
  }
}

/**
 * Cloud Synchronization Enablers
 */

export async function uploadLocalToCloud(userId: string) {
  const localProg = getLocalProgress();
  const localRev = getLocalReviews();

  console.log(`Synchronizing ${Object.keys(localProg).length} progress items and ${localRev.length} reviews to the cloud...`);

  // Sync progress items
  for (const topicId of Object.keys(localProg)) {
    const item = localProg[topicId];
    await saveProgressCloud(userId, item);
  }

  // Sync reviews
  for (const r of localRev) {
    await saveReviewCloud(userId, r);
  }
}

export function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      result[key as keyof T] = obj[key];
    }
  });
  return result;
}

export async function saveProgressCloud(userId: string, progressItem: UserTopicProgress) {
  const path = `users/${userId}/progress/${progressItem.topicId}`;
  try {
    const payload = { ...cleanUndefined(progressItem), userId };
    await setDoc(doc(db, 'users', userId, 'progress', progressItem.topicId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveReviewCloud(userId: string, reviewItem: ReviewEvent) {
  const path = `users/${userId}/reviews/${reviewItem.id}`;
  try {
    const payload = { ...cleanUndefined(reviewItem), userId };
    await setDoc(doc(db, 'users', userId, 'reviews', reviewItem.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteReviewCloud(userId: string, reviewId: string) {
  const path = `users/${userId}/reviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'reviews', reviewId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadProgressCloud(userId: string): Promise<Record<string, UserTopicProgress>> {
  const path = `users/${userId}/progress`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'progress'));
    const result: Record<string, UserTopicProgress> = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data() as UserTopicProgress;
      result[data.topicId] = data;
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {};
  }
}

export async function loadReviewsCloud(userId: string): Promise<ReviewEvent[]> {
  const path = `users/${userId}/reviews`;
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'reviews'));
    const result: ReviewEvent[] = [];
    snap.forEach((docSnap) => {
      result.push(docSnap.data() as ReviewEvent);
    });
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
