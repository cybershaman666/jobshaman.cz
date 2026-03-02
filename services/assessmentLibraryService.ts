import { BACKEND_URL } from '../constants';
import { Assessment } from '../types';
import { authenticatedFetch } from './csrfService';

const jsonHeaders = { 'Content-Type': 'application/json' };
let assessmentLibraryUnavailable = false;

export const listCompanyAssessmentLibrary = async (): Promise<Assessment[]> => {
  if (assessmentLibraryUnavailable) return [];
  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/assessments/company-library`, {
      method: 'GET',
      headers: jsonHeaders
    });
    if (!response.ok) {
      if ([404, 409, 501].includes(response.status)) assessmentLibraryUnavailable = true;
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload?.assessments) ? payload.assessments as Assessment[] : [];
  } catch {
    return [];
  }
};

export const duplicateCompanyAssessment = async (assessmentId: string): Promise<Assessment | null> => {
  if (!assessmentId) return null;
  if (assessmentLibraryUnavailable) return null;
  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/assessments/company-library/${assessmentId}/duplicate`, {
      method: 'POST',
      headers: jsonHeaders
    });
    if (!response.ok) {
      if ([404, 409, 501].includes(response.status)) assessmentLibraryUnavailable = true;
      return null;
    }
    const payload = await response.json();
    return payload?.assessment || null;
  } catch {
    return null;
  }
};

export const updateCompanyAssessmentStatus = async (
  assessmentId: string,
  status: 'active' | 'archived'
): Promise<boolean> => {
  if (!assessmentId) return false;
  if (assessmentLibraryUnavailable) return false;
  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/assessments/company-library/${assessmentId}/status`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status })
    });
    if ([404, 409, 501].includes(response.status)) assessmentLibraryUnavailable = true;
    return response.ok;
  } catch {
    return false;
  }
};
