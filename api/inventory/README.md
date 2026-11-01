# Inventario FIFO

Este módulo vive en la misma API de productos y usa el encabezado `domain` para aislar cada negocio.

## Flujo simple

- Al crear un producto con `stock` y `cost_price`, la API crea automáticamente el almacén `Principal`, el proveedor `Compra directa`, una entrada y su lote FIFO.
- Las reposiciones se registran con `POST /api/inventory/entries`.
- El stock y el costo visible del producto se actualizan desde los lotes; no se deben modificar directamente una vez que el artículo tiene trazabilidad.
- Una salida se registra con `POST /api/inventory/consume`. La API descuenta primero el lote más antiguo disponible.
- `GET /api/inventory/summary` entrega capital invertido, costo de ventas, utilidad bruta y margen para el dashboard.
- El stock creado antes de este módulo se convierte una sola vez con `POST /api/inventory/bootstrap`, indicando el costo unitario de apertura. La operación conserva la cantidad visible y evita duplicarla.

## Integración con pedidos

Cuando un pedido alcance el estado configurado (`paid` por defecto), el servicio de pedidos debe llamar:

```json
{
  "idempotencyKey": "order:<order-id>",
  "referenceType": "order",
  "referenceId": "<order-id>",
  "type": "sale",
  "lines": [
    {
      "productId": "<product-id>",
      "variationId": "<variation-id-opcional>",
      "quantity": 2,
      "unitSalePrice": 12.5
    }
  ]
}
```

La clave de idempotencia evita descontar dos veces el mismo pedido. Si el pedido se anula después de descontar stock, use `POST /api/inventory/movements/:id/reverse`.

## Operación avanzada

Las rutas `/warehouses`, `/suppliers`, `/items` y `/recipes` permiten activar múltiples almacenes, proveedores e insumos/recetas sin complicar el flujo simple.
