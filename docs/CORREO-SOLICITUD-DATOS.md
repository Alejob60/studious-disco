# Correo para solicitar datos a un cliente

Plantilla lista para enviar. Los corchetes son lo que hay que personalizar.
Los archivos van adjuntos: `plantilla-demanda.csv` y `docs/CONTRATO-DATOS.md`.

---

## Correo

**Asunto:** ¿Podemos medir su pronóstico de demanda? 15 minutos de su lado

> Estimado/a [nombre],
>
> Somos ColombiaTIC Ingeniería y estamos construyendo una herramienta que
> anticipa cuántos días va a vender, y que se equivoca menos que una regla simple.
>
> Antes de decirles que funciona, queremos medirse sobre **datos reales**. Su
> tienda es exactamente lo que necesitamos.
>
> **Lo que necesitamos:** un archivo CSV con dos columnas y al menos 90 días.
>
> | Columna | Qué es |
> |---|---|
> | `date` | La fecha de cada día |
> | `units` | Las unidades que vendió ese día |
>
> Adjuntamos una plantilla para que no tenga que adivinar el formato. Si su
> archivo ya existe con esas columnas, nos sirve tal cual.
>
> **Dos cosas que conviene saber antes de mandarlo:**
>
> 1. Si su Excel está en español, guárdelo con **punto y coma** y los números con
>    coma decimal (`1.234,50`). Si lo guarda con coma, el sistema rechaza los
>    decimales en vez de adivinar.
> 2. Si algún día no vendió porque **el producto estaba agotado** o la tienda
>    estaba cerrada, ese cero no es demanda. Alugins con la columna de stock si
>    la tienen. Ahora mismo el sistema nos puede *avisar* de esos días, pero no
>    puede corregirlos — y corregirlos es lo que haría que la medición sea de
>    verdad.
>
> **Qué le devolvemos, en 24 horas:**
>
> - El error de nuestro modelo y el de una regla que solo repite la semana
>   anterior, medidos sobre los mismos 14 días que el modelo nunca vio
> - Cuántas unidades por día se ahorran de error, y a cuánto está eso en plata
>   con su margen de contribución real
> - Un pronóstico de 14 días con su intervalo de confianza
> - Un informe de calidad del archivo: si hay días en cero sospechosos, saltos en
>   el calendario o picos por promoción
>
> Si el resultado no nos favorece, se lo decimos. Preferimos que nos digan que
> no sirve ahora que descubrirlo con su plata.
>
> Adjunto el [contrato de datos][contrato] con el detalle, o puede probarlo usted
> mismo en 30 segundos: [subir mi CSV][app].
>
> Si prefiere, mándenos el archivo y lo corremos nosotros.
>
> Un saludo,
> [nombre] · ColombiaTIC Ingeniería SAS
> enterprise@colombiatic.com.co

[contrato]: (adjuntar `docs/CONTRATO-DATOS.md`)
[app]: https://main.d28ukybtuih8pa.amplifyapp.com

---

## Archivos adjuntos

| Archivo | Qué es |
|---|---|
| `plantilla-demanda.csv` | Vacía, con las dos columnas y las instrucciones en comentarios |
| `CONTRATO-DATOS.md` | El detalle completo: qué formatos aceptamos, qué rechazamos y por qué |
| `sample-demand.csv` *(opcional)* | Una tienda ficticia con datos limpios, por si quieren ver un ejemplo lleno |
| `sample-demand-real.csv` *(opcional)* | La misma tienda con quiebres de stock, una semana cerrada y dos promociones. Muestra lo que el sistema detecta |

## Si piden llamar

Es la opción más rápida: le pedimos que exporte el histórico de ventas del mismo
producto y lo revise en pantalla antes de mandarlo. Con eso se resuelve en diez
minutos y se evita el intercambio de correos.

## Checklist antes de mandar

- [ ] La plantilla va adjunta, no solo enlazada
- [ ] El nombre del destinatario está correcto
- [ ] `enterprise@colombiatic.com.co` recibe la copia
- [ ] Si el cliente usa Excel en español, se menciona el punto y coma (es la causa
      número uno de un archivo rechazado)
- [ ] Si el cliente tiene columna de stock, se menciona — es lo que más valor
      aporta y lo que menos va a costarles
