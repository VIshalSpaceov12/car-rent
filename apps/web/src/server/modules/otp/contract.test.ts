import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/db', () => ({
  prisma: {
    otp: { findUnique: vi.fn() },
    contract: { findUnique: vi.fn(), upsert: vi.fn() },
    booking: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/server/db';
import { signContract, ContractError } from './contract';

const mockOtpFind = vi.mocked(prisma.otp.findUnique);
const mockContractFind = vi.mocked(prisma.contract.findUnique);
const mockTx = vi.mocked(prisma.$transaction);

function makeTxExecutor(contractRow: object, bookingRow: object) {
  // $transaction receives a callback; we execute it with a mock tx object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (mockTx as unknown as { mockImplementation: (fn: (...args: any[]) => any) => void }).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        contract: {
          upsert: vi.fn().mockResolvedValue(contractRow),
        },
        booking: {
          update: vi.fn().mockResolvedValue(bookingRow),
        },
      };
      return fn(tx);
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const consumedOtp = {
  bookingId: 'b1',
  vehicleId: 'v1',
  consumedAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 1,
};

const unconsumedOtp = {
  bookingId: 'b1',
  vehicleId: 'v1',
  consumedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
};

const contractRow = {
  id: 'c1',
  bookingId: 'b1',
  providerId: 'p1',
  signatureName: 'John Doe',
  signedAt: new Date(),
  termsVersion: '1.0',
};

const bookingRow = {
  id: 'b1',
  status: 'PICKED_UP',
  vehicle: { id: 'v1', name: 'Test Car' },
  startDate: new Date('2025-08-01'),
  endDate: new Date('2025-08-04'),
  plan: 'DAILY',
  baseAmount: 300,
  taxAmount: 31.5,
  serviceCharge: 15,
  totalAmount: 346.5,
  currency: 'USD',
  createdAt: new Date(),
  pickupBranch: null,
  dropoffBranch: null,
};

describe('signContract', () => {
  it('succeeds when OTP is consumed and booking is vehicle-prepared', async () => {
    mockOtpFind.mockResolvedValue(consumedOtp as never);
    mockContractFind.mockResolvedValue(null);
    makeTxExecutor(contractRow, bookingRow);

    const result = await signContract('b1', {
      signatureName: 'John Doe',
      providerId: 'p1',
      vehicleId: 'v1',
      currentStatus: 'vehicle-prepared',
    });

    expect(result.contract).toBeDefined();
    expect(result.booking).toBeDefined();
  });

  it('throws ContractError(otp_not_consumed) when OTP not consumed', async () => {
    mockOtpFind.mockResolvedValue(unconsumedOtp as never);

    await expect(
      signContract('b1', {
        signatureName: 'Jane Doe',
        providerId: 'p1',
        vehicleId: 'v1',
        currentStatus: 'vehicle-prepared',
      })
    ).rejects.toMatchObject({ code: 'otp_not_consumed' });
  });

  it('throws ContractError(otp_not_consumed) when no OTP row exists', async () => {
    mockOtpFind.mockResolvedValue(null);

    await expect(
      signContract('b1', {
        signatureName: 'Jane Doe',
        providerId: 'p1',
        vehicleId: 'v1',
        currentStatus: 'vehicle-prepared',
      })
    ).rejects.toMatchObject({ code: 'otp_not_consumed' });
  });

  it('throws ContractError(wrong_status) when booking is not vehicle-prepared', async () => {
    mockOtpFind.mockResolvedValue(consumedOtp as never);

    await expect(
      signContract('b1', {
        signatureName: 'John Doe',
        providerId: 'p1',
        vehicleId: 'v1',
        currentStatus: 'confirmed',
      })
    ).rejects.toMatchObject({ code: 'wrong_status' });
  });

  it('transitions booking to picked-up inside the transaction', async () => {
    mockOtpFind.mockResolvedValue(consumedOtp as never);
    mockContractFind.mockResolvedValue(null);
    makeTxExecutor(contractRow, { ...bookingRow, status: 'PICKED_UP' });

    const result = await signContract('b1', {
      signatureName: 'John Doe',
      providerId: 'p1',
      vehicleId: 'v1',
      currentStatus: 'vehicle-prepared',
    });

    // The booking returned should reflect the picked-up status
    expect((result.booking as unknown as typeof bookingRow).status).toBe('PICKED_UP');
  });
});
