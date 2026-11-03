const test = require('node:test');
const assert = require('node:assert/strict');
const { InventoryError, toMinor, fromMinor, rangeDate, planFifoAllocations, incrementStockSafely } = require('../api/inventory/inventory.service');

test('convierte importes a centavos sin errores de punto flotante', () => {
    assert.equal(toMinor(10.10), 1010);
    assert.equal(fromMinor(1010), 10.10);
});

test('FIFO consume primero el lote más antiguo y conserva su costo', () => {
    const lots = [
        { _id: 'old', availableQuantity: 3, unitCostMinor: 400 },
        { _id: 'new', availableQuantity: 5, unitCostMinor: 550 }
    ];
    const plan = planFifoAllocations(lots, 4);
    assert.deepEqual(plan.map(({ lot, quantity, unitCostMinor, totalCostMinor }) => ({
        lotId: lot._id,
        quantity,
        unitCostMinor,
        totalCostMinor
    })), [
        { lotId: 'old', quantity: 3, unitCostMinor: 400, totalCostMinor: 1200 },
        { lotId: 'new', quantity: 1, unitCostMinor: 550, totalCostMinor: 550 }
    ]);
});

test('FIFO rechaza una salida mayor al stock disponible', () => {
    assert.throws(
        () => planFifoAllocations([{ availableQuantity: 2, unitCostMinor: 100 }], 3),
        (error) => error instanceof InventoryError && error.status === 409
    );
});

test('normaliza stock legado nulo antes de incrementar', () => {
    assert.deepEqual(incrementStockSafely(5), [{
        $set: {
            stock: {
                $add: [
                    { $convert: { input: '$stock', to: 'double', onError: 0, onNull: 0 } },
                    5
                ]
            }
        }
    }]);
});

test('interpreta los rangos diarios en horario de Lima', () => {
    assert.equal(rangeDate('2026-11-02').toISOString(), '2026-11-02T05:00:00.000Z');
    assert.equal(rangeDate('2026-11-02', true).toISOString(), '2026-11-03T04:59:59.999Z');
});
