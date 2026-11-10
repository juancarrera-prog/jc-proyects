# CASA · Family Hub

Aplicación familiar móvil con Google Sheets + Google Apps Script. No usa Firebase.

## Archivos
- `Code.gs`: backend; lee/escribe las tres pestañas de la planilla, con bloqueo de concurrencia.
- `Index.html`: interfaz móvil para compras, pendientes y prioridades del hogar.
- `tests/`: pruebas locales del catálogo, tema y accesos rápidos, con compatibilidad con los datos existentes (Node.js, sin dependencias).

## Apariencia y accesos rápidos
- El botón **Modo oscuro / Modo claro** está disponible desde la pantalla inicial, antes de introducir la clave, y también en el encabezado después de ingresar.
- La primera visita usa la apariencia del sistema. La elección manual se recuerda en ese navegador mediante la única preferencia local `casa.theme`. Si el navegador bloquea ese almacenamiento, el cambio sigue funcionando durante la sesión. La clave y los datos familiares no se guardan allí.
- En **Compras → Mi lista**, **+ Pan**, **+ Leche** y **+ Huevos** agregan productos en un toque. Los botones muestran **✓** cuando el producto ya está pendiente. Los productos completados se pueden volver a agregar mediante el comportamiento del backend existente.
- **★ Tus favoritos** muestra hasta seis accesos rápidos compartidos. **Ver favoritos** abre el catálogo filtrado para consultar o agregar el resto. Las estrellas del catálogo mantienen el protocolo existente de `changeCasaCatalog`.
- Los botones rápidos usan `changeCasa(pin, 'compras', 'add', {producto, categoria})`. No se requieren nuevas funciones, propiedades ni pestañas en el backend actual. Con una respuesta antigua que no incluya catálogo, los botones y la lista siguen funcionando; los favoritos requieren el `Code.gs` con soporte de catálogo.
- Esta actualización de apariencia y accesos rápidos sólo modifica `Index.html`; conserva `Code.gs` y no ejecuta operaciones contra la planilla familiar durante las pruebas.

## Compras: lista y catálogo
- **Mi lista** conserva el ingreso rápido y las acciones de completar, eliminar y vaciar.
- **Agregar productos** ofrece 65 productos iniciales en Alimentos, Lácteos y huevos, Frutas y verduras, Limpieza, Higiene personal, Bebidas y Mascotas. La sección Otros permite clasificar productos propios.
- El buscador filtra por nombre sin distinguir mayúsculas ni tildes; se combina con la sección elegida o con **★ Favoritos**.
- Tocá **☆** para marcar un favorito compartido por la familia. Los favoritos no se agregan automáticamente a la compra.
- **Crear producto** pide nombre y sección y lo guarda en el catálogo compartido. Luego tocá **+ Agregar** para llevarlo a la compra. El ingreso rápido de Mi lista agrega sólo a la compra, sin crear un producto en el catálogo.
- **En tu lista** evita agregar dos veces un producto pendiente, también si ambos teléfonos lo intentan. Si estaba completado, se vuelve a marcar como pendiente y conserva su cantidad.
- Los productos propios y favoritos sobreviven al vaciar la lista y a recargar/cambiar de teléfono. Se guardan en una pestaña adicional **CASA_Productos**, creada automáticamente en la primera escritura de un favorito o producto propio. No hace falta crearla ni cargar el catálogo base a mano. No renombres sus encabezados: `id`, `producto`, `categoria`, `favorito`, `creado_en`, `actualizado_en`.

## Base
Google Sheet: https://docs.google.com/spreadsheets/d/1eJn7myZ6kfHhtcdRPTtryt50dPmf87BUXG701WvIyAI/edit
Pestañas existentes: `CASA_Compras`, `CASA_Pendientes`, `CASA_Semaforo`. La actualización agrega `CASA_Productos` al guardar el primer favorito o producto propio; conserva las otras pestañas.

## Instalación (requiere la cuenta propietaria de Google)
1. Abrí la planilla y elegí **Extensiones → Apps Script**.
2. Reemplazá el contenido de `Code.gs` por el archivo de este repositorio.
3. Creá un archivo **HTML** llamado `Index` y pegá el contenido de `Index.html` (el editor agrega la extensión automáticamente).
4. En **Configuración del proyecto → Propiedades del script**, agregá una propiedad `CASA_PIN` con una **clave larga, única y difícil de adivinar** (idealmente una contraseña aleatoria de 20+ caracteres). No la escribas en el repositorio.
5. Guardá. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: **Yo**. Acceso: **Solo yo** si es para probar. Para compartir con una cuenta externa, la opción **Cualquier persona** puede ser necesaria, dependiendo de las políticas de Google Workspace. En ese caso el acceso real se controla con la clave familiar y el enlace; no equivale a autenticación robusta por usuario.
6. Abrí la URL /exec y probá alta, completado y borrado. Compartí el enlace y la clave por canales separados con tu pareja.
7. Para futuras actualizaciones: pegá los archivos nuevos en Apps Script y usá **Administrar implementaciones → Editar → Nueva versión**.

## Actualizar una instalación existente
1. Copiá **ambos archivos actuales**, `Code.gs` e `Index.html`, al proyecto Apps Script (`Index.html` corresponde al archivo HTML `Index`). Guardá los cambios.
2. Conservá `CASA_PIN` en las propiedades del script. No vuelvas a ejecutar `setupCasa` ni cambies la clave para esta actualización. El teclado numérico inicial incluye la opción de teclado completo para claves alfanuméricas.
3. Elegí **Implementar → Administrar implementaciones**, seleccioná la implementación actual y tocá el lápiz **Editar**. En **Versión**, elegí **Nueva versión**, agregá una descripción y pulsá **Implementar**. Conservá los permisos y la cuenta de ejecución existentes. Al editar la implementación actual se mantiene el mismo enlace `/exec`.
4. Abrí de nuevo el enlace en ambos teléfonos. Probá: buscar un producto, agregarlo, marcarlo favorito, crear uno propio y actualizar el otro teléfono. Verificá que al vaciar la compra sigan disponibles el producto propio y la estrella.

Si ya tenés el backend de catálogo de este repositorio, para la actualización de modo oscuro y botones rápidos alcanza con reemplazar **Index**, guardar y publicar una **Nueva versión** de la implementación actual. No hace falta volver a configurar la clave ni modificar la planilla.

Actualizar GitHub no publica automáticamente el proyecto de Apps Script. Referencia: https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment

## Seguridad y límites
- El repositorio es **público**: nunca subas PIN, tokens, cookies ni información familiar real.
- El HTML corre dentro de Apps Script, no directamente en GitHub Pages; usa `google.script.run` para comunicarse con el backend sin credenciales en el navegador.
- Si desplegás como «Cualquier persona», cualquiera que consiga la URL puede intentar adivinar la clave. Para datos familiares sensibles, preferí una solución con autenticación Google real y permisos individuales. No reutilices la clave de tu cuenta Google.
- La clave se introduce en cada carga de la página, no se almacena en el navegador.
- Los cambios del catálogo exigen la misma clave y usan el mismo bloqueo de concurrencia que la lista. Los nombres se muestran como texto y se escapan al escribir en Sheets para evitar fórmulas introducidas como nombres de productos.
- Sincronización mediante actualización cada 20 segundos mientras la pestaña esté visible; no es tiempo real instantáneo.
- Las tareas recurrentes, notificaciones push y el agregado automático de favoritos a la compra son mejoras futuras.
- Antes de activar el acceso público, revisá las políticas de tu organización sobre despliegue de Apps Script y uso personal de Workspace.

## Desarrollo
Modificá ambos archivos en este directorio, replicá los cambios en el proyecto Apps Script y publicá una versión nueva. La planilla es la fuente de datos persistente.

Desde la raíz del repositorio, ejecutá `node --test casa/tests/catalog.test.cjs casa/tests/interface.test.cjs`. Las pruebas usan servicios de Apps Script simulados y datos ficticios; no acceden a la planilla ni contienen la clave familiar. Cubren autenticación, persistencia de favoritos, duplicados, respuestas del backend anterior, modos claro/oscuro y almacenamiento local bloqueado. La comprobación final del despliegue y del teclado debe hacerse en un iPhone real.


