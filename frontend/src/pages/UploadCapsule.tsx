function UploadCapsule() {
  return (
    <section className="page-card form-card">
      <div>
        <h1>Subir capsula</h1>
        <p>Crea un nuevo recuerdo con titulo, descripcion y archivos multimedia.</p>
      </div>

      <label className="field">
        <span>Titulo</span>
        <input type="text" placeholder="Ejemplo: Mi concierto favorito" />
      </label>

      <label className="field">
        <span>Categoria</span>
        <select defaultValue="">
          <option value="" disabled>
            Selecciona una categoria
          </option>
          <option value="familia">Familia</option>
          <option value="viajes">Viajes</option>
          <option value="amistad">Amistad</option>
        </select>
      </label>

      <label className="field">
        <span>Descripcion</span>
        <textarea placeholder="Describe el momento que quieres guardar" />
      </label>

      <label className="field">
        <span>Archivos</span>
        <input type="file" multiple />
      </label>

      <div className="button-row">
        <button type="button" className="button-primary">Guardar capsula</button>
        <button type="button" className="button-secondary">Guardar borrador</button>
      </div>
    </section>
  )
}

export default UploadCapsule