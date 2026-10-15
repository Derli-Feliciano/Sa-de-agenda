const ID_PLANILHA = "1Gprl1wET-hnVj-aRhUF0piksZVu1BTeEIIzKlpm69AU"; 

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.openById(ID_PLANILHA);
    let response = { success: false, message: "", data: null };

    if (method === 'GET') {
      const action = e.parameter.action;
      let data = null;
      
      if (action === 'listarMedicos') {
        data = getSheetData(ss, 'Medicos');
        response = { success: true, message: "", data: data };
      }
      else if (action === 'listarPacientes') {
        data = getSheetData(ss, 'Pacientes');
        response = { success: true, message: "", data: data };
      }
      else if (action === 'listarAgendamentos') {
        data = getSheetData(ss, 'Agendamentos');
        response = { success: true, message: "", data: data };
      }
      else if (action === 'login') {
        // ✅ ACEITA 'usuario' OU 'email' (fallback para compatibilidade)
        const usuario = e.parameter.usuario || e.parameter.email;
        response = login(usuario, e.parameter.senha, ss);
      }
      // ✅ NOVA AÇÃO: Verificar horários ocupados
      else if (action === 'verificarHorariosOcupados') {
        response = verificarHorariosOcupados(e.parameter.medicoId, e.parameter.data, ss);
      }
      // ✅ Ação para cancelar consulta
      else if (action === 'cancelarConsulta') {
        updateStatus(ss, 'Agendamentos', e.parameter.id, 'Cancelada');
        response = { success: true, message: "Consulta cancelada!" };
      }
      else {
        response = { success: false, message: "Ação não reconhecida: " + action };
      }
    }
    else if (method === 'POST') {
      const data = JSON.parse(e.postData.contents);
      const action = data.action;

      if (action === 'cadastrarPaciente') {
        const id = new Date().getTime().toString();
        addRow(ss, 'Pacientes', [id, data.nome, data.cpf, data.telefone, data.nascimento]);
        response = { success: true, message: "Paciente cadastrado!" };
      } 
      else if (action === 'agendarConsulta') {
        const agendamentos = getSheetData(ss, 'Agendamentos');
        
        const conflito = agendamentos.find(a => 
          String(a[3]) === String(data.medicoId) &&
          String(a[5]) === String(data.data) &&
          String(a[6]) === String(data.hora) &&
          String(a[7]) !== 'Cancelada'
        );

        if (conflito) {
          response = { success: false, message: "Horário já ocupado para este médico!" };
        } else {
          const id = new Date().getTime().toString();
          
          const medicos = getSheetData(ss, 'Medicos');
          const medico = medicos.find(m => String(m[0]) === String(data.medicoId));
          
          if (!medico) {
            response = { success: false, message: "Médico não encontrado!" };
          } else {
            addRow(ss, 'Agendamentos', [
              id,
              data.pacienteId,
              data.pacienteNome,
              data.medicoId,
              medico[1],
              data.data,
              data.hora,
              'Agendada'
            ]);
            response = { success: true, message: "Consulta agendada com sucesso!" };
          }
        }
      }
      else if (action === 'cancelarConsulta') {
        updateStatus(ss, 'Agendamentos', data.id, 'Cancelada');
        response = { success: true, message: "Consulta cancelada!" };
      }
    }

    return jsonResponse(response);

  } catch (err) {
    return jsonResponse({ success: false, message: "Erro interno: " + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- Funções Auxiliares ---

function getSheetData(ss, sheetName) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      console.error(`Planilha "${sheetName}" não encontrada!`);
      return [];
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    data.shift();
    
    return data.map(row => row.map((cell, index) => {
      if (sheetName === 'Agendamentos' && index === 6) {
        if (cell instanceof Date) {
          const hora = cell.getHours().toString().padStart(2, '0');
          const minuto = cell.getMinutes().toString().padStart(2, '0');
          return `${hora}:${minuto}`;
        }
        return String(cell || '');
      }
      
      if (cell instanceof Date) {
        const yyyy = cell.getFullYear();
        const mm = String(cell.getMonth() + 1).padStart(2, '0');
        const dd = String(cell.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return cell;
    }));
  } catch (error) {
    console.error(`Erro ao ler planilha ${sheetName}:`, error);
    return [];
  }
}

function addRow(ss, sheetName, rowData) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Planilha "${sheetName}" não encontrada!`);
    if (!rowData || rowData.length === 0) throw new Error("Dados vazios para inserir");
    
    if (sheetName === 'Agendamentos') {
      if (rowData[6] && !rowData[6].toString().startsWith("'")) {
        rowData[6] = "'" + rowData[6].toString();
      }
    }
    
    sheet.appendRow(rowData);
    return true;
  } catch (error) {
    console.error(`Erro ao adicionar linha em ${sheetName}:`, error);
    return false;
  }
}

function updateStatus(ss, sheetName, id, status) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.getRange(i + 1, 8).setValue(status);
        console.log(`Status atualizado para ${status} no ID ${id}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error(`Erro ao atualizar status:`, error);
    return false;
  }
}

// ✅ FUNÇÃO LOGIN ATUALIZADA - case-insensitive + parâmetro genérico
function login(usuario, senha, ss) {
  const users = getSheetData(ss, 'Usuarios');
  
  // Normaliza entrada: remove espaços e converte para minúsculo
  const usuarioInput = String(usuario || '').toLowerCase().trim();
  
  const user = users.find(u => {
    const usuarioCadastrado = String(u[2] || '').toLowerCase().trim();
    return usuarioCadastrado === usuarioInput && String(u[3]) === String(senha);
  });
  
  if (user) {
    return { success: true, message: "Login realizado", data: { nome: user[1], tipo: user[4] } };
  }
  return { success: false, message: "Palavra-chave ou senha inválida" };
}

// ✅ NOVA FUNÇÃO: Verificar horários ocupados
function verificarHorariosOcupados(medicoId, data, ss) {
  try {
    if (!medicoId || !data) {
      return { success: false, message: "Médico e data são obrigatórios", data: [] };
    }
    
    const agendamentos = getSheetData(ss, 'Agendamentos');
    
    const horariosOcupados = agendamentos
      .filter(a => {
        return String(a[3]) === String(medicoId) && 
               String(a[5]) === String(data) && 
               String(a[7]) !== 'Cancelada';
      })
      .map(a => String(a[6]).replace(/^'/, ''));
    
    return { 
      success: true, 
      message: "Horários carregados com sucesso", 
      data: horariosOcupados 
    };
    
  } catch (error) {
    console.error("Erro ao verificar horários ocupados:", error);
    return { success: false, message: error.toString(), data: [] };
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}