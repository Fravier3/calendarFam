# Centro Vázquez Santiago

PWA móvil y visor Android TV. Ejecuta `npm ci` y `npm run build`. El APK abre el despliegue de Vercel en horizontal y recibe los cambios de la interfaz web al volver a abrirla.

El calendario incluye vistas Día y Agenda con las notas completas. Appwrite limita la lectura de registros compartidos al equipo privado `calendarfam-hogar`. Los propietarios de los registros pueden editarlos. La TV conserva su sesión en el dispositivo después de iniciar sesión con la cuenta familiar. La TV abre en Ambiente, muestra el menú al usar el control y consulta los datos al entrar, al volver a primer plano y cada cinco minutos mientras está visible.

Para compilar el APK usa `android/build.sh`, las herramientas del Android SDK, los fondos WebP y el almacén de firma externo. Conserva la misma firma para actualizar una instalación existente.
