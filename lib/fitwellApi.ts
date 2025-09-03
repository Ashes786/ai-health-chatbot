// lib/fitwellApi.ts

/* global fetch */

import { ServiceAction } from '../types';

const FITWELL_BASE_URL = (global as any).__FITWELL_API_BASE || process.env.FITWELL_API_BASE || '';
const FITWELL_API_KEY = (global as any).__FITWELL_API_KEY || process.env.FITWELL_API_KEY || '';

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function bookDoctor(params: Record<string, any>) {
  if (!FITWELL_BASE_URL) {
    // Mock response for development/demo
    await delay(700);
    return {
      success: true,
      bookingId: `mock-doc-${Date.now()}`,
      details: {
        doctor: params.doctor || 'General Physician',
        time: params.time || 'Tomorrow, 10:00 AM',
        location: params.location || 'Fitwell Clinic - Downtown'
      }
    };
  }

  try {
    const res = await fetch(`${FITWELL_BASE_URL}/bookings/doctor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(FITWELL_API_KEY ? { Authorization: `Bearer ${FITWELL_API_KEY}` } : {})
      },
      body: JSON.stringify(params)
    });

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('bookDoctor error', err);
    return { success: false, error: String(err) };
  }
}

export async function bookLab(params: Record<string, any>) {
  if (!FITWELL_BASE_URL) {
    await delay(700);
    return {
      success: true,
      bookingId: `mock-lab-${Date.now()}`,
      details: {
        tests: params.tests || ['CBC'],
        time: params.time || 'Tomorrow, 9:00 AM',
        location: params.location || 'Fitwell Lab - Uptown'
      }
    };
  }

  try {
    const res = await fetch(`${FITWELL_BASE_URL}/bookings/lab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(FITWELL_API_KEY ? { Authorization: `Bearer ${FITWELL_API_KEY}` } : {})
      },
      body: JSON.stringify(params)
    });

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('bookLab error', err);
    return { success: false, error: String(err) };
  }
}

export async function orderMedicine(params: Record<string, any>) {
  if (!FITWELL_BASE_URL) {
    await delay(600);
    return {
      success: true,
      orderId: `mock-med-${Date.now()}`,
      details: {
        items: params.items || [],
        eta: '2 business days',
        pharmacy: 'Fitwell Pharmacy - Central'
      }
    };
  }

  try {
    const res = await fetch(`${FITWELL_BASE_URL}/orders/medicine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(FITWELL_API_KEY ? { Authorization: `Bearer ${FITWELL_API_KEY}` } : {})
      },
      body: JSON.stringify(params)
    });

    const json = await res.json();
    return json;
  } catch (err) {
    console.error('orderMedicine error', err);
    return { success: false, error: String(err) };
  }
}

export async function callServiceAction(action: ServiceAction) {
  switch (action.type) {
    case 'book_doctor':
      return bookDoctor(action.params || {});
    case 'book_lab':
      return bookLab(action.params || {});
    case 'order_medicine':
      return orderMedicine(action.params || {});
    default:
      return { success: false, error: 'Unknown action type' };
  }
}