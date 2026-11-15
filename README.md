# Centro Vázquez Santiago

PWA móvil y visor Android TV. Ejecuta `npm ci` y `npm run build`. El APK abre el despliegue de Vercel en horizontal y recibe los cambios de la interfaz web al volver a abrirla.

El calendario incluye vistas Día y Agenda con las notas completas. Appwrite controla el acceso a los eventos y fondos privados de cada cuenta. La TV abre en Ambiente, muestra el menú al usar el control y consulta los datos al entrar, al volver a primer plano y cada cinco minutos mientras está visible.

Para compilar el APK usa `android/build.sh`, las herramientas del Android SDK, los fondos WebP y el almacén de firma externo. Conserva la misma firma para actualizar una instalación existente.
