# product

## Zona horaria

El servicio lee la zona IANA guardada por dominio en Configurations para interpretar los filtros diarios del resumen de inventario y las fechas calendario de ingresos de stock. Las marcas de tiempo de creación continúan guardándose como instantes UTC.

Configura `CONFIGURATION_API_URL` en `.env` para apuntar al servicio de configuraciones. En desarrollo local usa `http://127.0.0.1:7000/api`; en producción apunta a la URL de Configurations desplegada.
 
