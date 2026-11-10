# CASA · Family Hub

Aplicación familiar móvil con Google Sheets + Google Apps Script. No usa Firebase.

## Archivos
- `Code.gs`: backend; lee/escribe las tres pestañas de la planilla, con bloqueo de concurrencia.
- `Index.html`: interfaz móvil para compras, pendientes y prioridades del hogar.

## Base
Google Sheet: https://docs.google.com/spreadsheets/d/1eJn7myZ6kfHhtcdRPTtryt50dPmf87BUXG701WvIyAI/edit
Pestañas: `CASA_Compras`, `CASA_Pendientes`, `CASA_Semaforo`.

## Instalación (requiere la cuenta propietaria de Google)
1. Abrí la planilla y elegí **Extensiones → Apps Script**.
2. Reemplazá el contenido de `Code.gs` por el archivo de este repositorio.
3. Creá un archivo **HTML** llamado `Index` y pegá el contenido de `Index.html` (el editor agrega la extensión automáticamente).
4. En **Configuración del proyecto → Propiedades del script**, agregá una propiedad `CASA_PIN` con una **clave larga, única y difícil de adivinar** (idealmente una contraseña aleatoria de 20+ caracteres). No la escribas en el repositorio.
5. Guardá. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: **Yo**. Acceso: **Solo yo** si es para probar. Para compartir con una cuenta externa, la opción **Cualquier persona** puede ser necesaria, dependiendo de las políticas de Google Workspace. En ese caso el acceso real se controla con la clave familiar y el enlace; no equivale a autenticación robusta por usuario.
6. Abrí la URL /exec y probá alta, completado y borrado. Compartí el enlace y la clave por canales separados con tu pareja.
7. Para futuras actualizaciones: pegá los archivos nuevos en Apps Script y usá **Administrar implementaciones → Editar → Nueva versión**.

## Seguridad y límites
- El repositorio es **público**: nunca subas PIN, tokens, cookies ni información familiar real.
- El HTML corre dentro de Apps Script, no directamente en GitHub Pages; usa `google.script.run` para comunicarse con el backend sin credenciales en el navegador.
- Si desplegás como «Cualquier persona», cualquiera que consiga la URL puede intentar adivinar la clave. Para datos familiares sensibles, preferí una solución con autenticación Google real y permisos individuales. No reutilices la clave de tu cuenta Google.
- La clave se introduce en cada carga de la página, no se almacena en el navegador.
- Sincronización mediante actualización cada 20 segundos mientras la pestaña esté visible; no es tiempo real instantáneo.
- Las tareas recurrentes, notificaciones push y listas frecuentes automáticas son mejoras futuras.
- Antes de activar el acceso público, revisá las políticas de tu organización sobre despliegue de Apps Script y uso personal de Workspace.

## Desarrollo
Modificá ambos archivos en este directorio, replicá los cambios en el proyecto Apps Script y publicá una versión nueva. La planilla es la fuente de datos persistente.
