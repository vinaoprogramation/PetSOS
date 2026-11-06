const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = 3000;

const corsOptions = {
    origin: "http://localhost:3001",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

app.use(cors(corsOptions));

app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Hello World!");
}
)


//MIDDLEWARES

function middlewareAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Token de autenticação não fornecido." });
    }


    const token = authHeader.split(" ");

    if (!token) {
        return res.status(401).json({ message: "Token de autenticação não fornecido." });
    }

    if (token[0] != "Bearer") {
        return res.status(401).json({ message: "Formato de token inválido." });
    }

    jwt.verify(token[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Token de autenticação inválido." });
        }

        req.usuario = decoded;
        next();
    });
}


// AUTENTICAÇÃO

function autentica(payload) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET não está definido no arquivo .env");
    }
    if (!payload || !payload.id || !payload.role) {
        throw new Error("Payload inválido para autenticação.");
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    return token;
}














// VALIDAÇÃO

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}







function validaUsuario(nome, email, senha, telefone) {
    if (!nome || !email || !senha || !telefone) {
        return { valid: false, message: "Todos os campos são obrigatórios." };
    }

    if (!validateEmail(email)) {
        return { valid: false, message: "O email fornecido não é válido." };
    }

    if (senha.length < 6) {
        return { valid: false, message: "A senha deve ter pelo menos 6 caracteres." };
    }

    return { valid: true };
}












function validaHorario(pets, tipo_atendimento, modalidade, endereco, horario_atendimento, dia_atendimento, id_cliente) {

    if (!pets || !tipo_atendimento || !modalidade || !endereco || !horario_atendimento || !dia_atendimento || !id_cliente) {
        return { valid: false, message: "Os campos são obrigatórios." };
    }

    return { valid: true };
}












function validaPets(pets) {
    const numero_pets = parseInt(pets.numero_pets);

    if (isNaN(numero_pets) || numero_pets <= 0) {
        return { valid: false, message: "O campo pets deve ser um número inteiro positivo." };
    }

    const lista_pets = pets.lista_pets;

    if (!Array.isArray(lista_pets) || lista_pets.length !== numero_pets) {
        return { valid: false, message: "O campo lista_pets deve ser um array com o mesmo número de elementos que numero_pets." };
    }

    const verificaLista = lista_pets.map((pet, index) => {
        if (!pet.nome || !pet.qualidade_pelo || !pet.idade || !pet.raca) {
            return { valid: false, message: `O pet na posição ${index} não possui todos os campos obrigatórios (nome, qualidade_pelo, idade).` };
        }
        return { valid: true };
    });

    if (verificaLista.some(result => !result.valid)) {
        const erro = verificaLista.find(result => !result.valid);
        return erro;
    }

    if (!pets) {
        return { valid: false, message: "O campo pets é obrigatório." };
    }

    const tempo = numero_pets * 30

    return { valid: true, tempo: tempo };
}













function validaEndereco(endereco) {
    enderecoRegex = /^[0-9]{5}-[0-9]{3}$/; // Formato de CEP: 00000-000

    if (!endereco.cep || !enderecoRegex.test(endereco.cep)) {
        return { valid: false, message: "O campo cep é obrigatório e deve estar no formato 00000-000." };
    }

    if (!endereco || !endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado) {
        return { valid: false, message: "Todos os campos do endereço são obrigatórios." };
    }

    return { valid: true };
}









async function validaCliente(id_cliente) {

    const buscaClienteQuery = "SELECT id FROM usuarios WHERE id = ?";

    const [buscaCliente] = await pool.execute(buscaClienteQuery, [id_cliente]);

    const clienteExiste = buscaCliente[0].length !== 0;

    if (!id_cliente) {
        return { valid: false, message: "O campo id é obrigatório." };
    }

    if (!clienteExiste) {
        return { valid: false, message: "O id fornecido não existe." };
    }

    return { valid: true };
}











async function validaTelefone(telefone) {
    const telefoneRegex = /^\d{10,11}$/; // Aceita apenas números com 10 ou 11 dígitos

    const testaTelefone = telefoneRegex.test(telefone);

    if (!testaTelefone) {
        return false; // Telefone não é válido
    }

    const buscaTelefoneQuery = "SELECT telefone FROM usuarios WHERE telefone = ?";

    const [buscaTelefone] = await pool.execute(buscaTelefoneQuery, [telefone]);


    if (buscaTelefone.length === 0) {
        return true;
    } else {
        return false; // Telefone existe no banco de dados
    }
}









async function buscaHorariosPreenchidos(dia_atendimento) {
    try {

        const verificaHorariosQuery = "SELECT COUNT(*) AS total_horarios FROM horarios WHERE dia_atendimento = ?";

        const [verificaHorarios] = await pool.execute(verificaHorariosQuery, [dia_atendimento]);

        if (verificaHorarios[0].total_horarios >= 480) {
            console.log("Limite de horários atingido para o dia de atendimento fornecido.")
            return { valid: false, message: "O limite de horários preenchidos para o dia de atendimento fornecido foi atingido." };
        }

        const buscaHorariosQuery = "SELECT horario_atendimento, tempo_atendimento FROM horarios WHERE dia_atendimento = ? ";

        const [buscaHorarios] = await pool.execute(buscaHorariosQuery, [dia_atendimento]);

        console.log(buscaHorarios)

        return { valid: true, message: "Horários disponíveis para o dia de atendimento fornecido.", horarios: buscaHorarios };
    } catch (error) {
        return { valid: false, message: "Erro ao buscar horários preenchidos." };
    }

}













function validaHorarioAtendimento(horario_atendimento, tempo) {
    const horarioRegex = /^([01]\d|2[0-1]):([0-5]\d)$/; // Formato HH:MM (24 horas)
    testeHorario = horarioRegex.test(horario_atendimento);

    if(horario_atendimento.split(":")[0] == 17 && horario_atendimento.split(":")[1] == 30 && tempo > 30){
        return { valid: false, message: "Horário ultrapassa expediente" };
    }

    if (!testeHorario) {
        return { valid: false, message: "O campo horario_atendimento deve estar no formato HH:MM (24 horas)." };
    } else {
        return { valid: true };
    }

}

function validaTipoAtendimento(tipo_atendimento) {
    const tiposValidos = ["banho", "tosa", "banho_e_tosa"];

    if (!tiposValidos.includes(tipo_atendimento)) {
        return { valid: false, message: "O campo tipo_atendimento deve ser 'banho', 'tosa' ou 'banho_e_tosa'." };
    }

    return { valid: true }
}


function validaModalidade(modalidade) {
    const modalidades = ["taxi", "normal"]

    if (!modalidades.includes(modalidade)) {
        return { valid: false, message: "O campo modalidade deve ser 'taxi' ou 'normal'." };
    }

    return { valid: true }
}

function validaDiaAtendimento(dia_atendimento) {
    const regexFormato = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!regexFormato.test(dia_atendimento)) {
        return { valid: false, menssage: "Formato inválido" };
    }

    console.log("Passou 1")

    const [ano, mes, dia] = dia_atendimento.split('-').map(Number);

    const dataRef = new Date(ano, mes - 1, dia);

    console.log("Passou 2")

    if (
        !dataRef.getFullYear() === ano ||
        !dataRef.getMonth() === (mes - 1) ||
        !dataRef.getDate() === dia
    ) {
        return { valid: false, menssage: "A data informada é inválida"}
    }

    console.log("Passou 3")
    return { valid: true };
}

function validaIdCliente(id){
    if (!Number(parseInt(id)) || id <=0 ) {
        return { valid: false, message: "O campo id um inteiro positivo "};
    }

    return {valid: true }

}


async function validacaoGeral(pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento, id_cliente) {
    try {

        const validandoPets = validaPets(pets)

        if (!validandoPets.valid) {
            return { valid: false, message: validandoPets.message };
        }

        if (!validaTipoAtendimento(tipo_atendimento).valid) {
            return { valid: false, message: validaTipoAtendimento(tipo_atendimento).message };
        }

        if (!validaModalidade(modalidade).valid) {
            return { valid: false, message: validaModalidade(modalidade).message };
        }


        if (!validaEndereco(endereco_busca).valid) {
            return { valid: false, message: validaEndereco(endereco_busca).message };
        }

        if (!validaHorarioAtendimento(horario_atendimento, validandoPets.tempo).valid) {
            return { valid: false, message: validaHorarioAtendimento(horario_atendimento).message };
        }

        if (!validaDiaAtendimento(dia_atendimento).valid) {
            return { valid: false, message: validaDiaAtendimento(dia_atendimento).message };
        }

        if (!validaIdCliente(id_cliente).valid) {
            return { valid: false, message: validaIdCliente(id_cliente).message };
        }

        return {valid: true, tempo: validandoPets.tempo}

    } catch (error) {
        console.error("Erro na validação geral:", error);
        return { valid: false, message: "Erro interno do servidor durante a validação geral." };
    }
}







// ABRE A PORTA
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});










//POSTA USUARIO
app.post("/api/usuario", async (req, res) => {

    try {
        const { nome, email, senha, telefone } = req.body;

        if (!validaUsuario(nome, email, senha, telefone).valid) {
            return res.status(400).json({ message: validaUsuario(nome, email, senha).message });
        }

        const buscaUsuarioQuery = "SELECT EXISTS(SELECT 1 FROM usuarios WHERE email = ?) AS email_existe";

        const buscaUsuario = await pool.execute(buscaUsuarioQuery, [email]);

        if (buscaUsuario[0][0].email_existe) {
            return res.status(400).json({ message: "O email fornecido já está em uso." });
        }

        const validaTelefoneResult = await validaTelefone(telefone);

        if (!validaTelefoneResult) {
            return res.status(400).json({ message: "O telefone fornecido não é válido ou já está em uso." });
        }

        const hashedPassword = await bcrypt.hash(senha, 10);

        const buscaNumeroUsuarios = "SELECT COUNT(*) AS total_usuarios FROM usuarios";

        const [rows] = await pool.execute(buscaNumeroUsuarios);

        let role = "cliente";

        if (rows[0].total_usuarios === 0) {
            role = "administrador";
        }

        const insertUsuarioQuery = "INSERT INTO usuarios (nome, email, senha, telefone, usuario_role) VALUES (?, ?, ?, ?, ?)";

        await pool.execute(insertUsuarioQuery, [nome, email, hashedPassword, telefone, role]);

        res.status(201).json({ message: "Usuário criado com sucesso." });

    } catch (error) {
        console.error("Erro ao criar usuário:", error, error.stack, error.message);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)










// LOGIN

app.post("/api/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ message: "Todos os campos são obrigatórios." });
        }

        const buscaUsuarioQuery = "SELECT * FROM usuarios WHERE email = ?";

        const [rows] = await pool.execute(buscaUsuarioQuery, [email]);


        if (rows.length === 0) {
            return res.status(400).json({ message: "Email ou senha incorretos." });
        }

        const usuario = rows[0];

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(400).json({ message: "Email ou senha incorretos." });
        }

        const usuarioPayload = {
            id: usuario.id,
            role: usuario.usuario_role
        };

        const token = autentica(usuarioPayload);

        res.status(200).json({ message: "Login bem-sucedido.", usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, token: token });

    } catch (error) {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)




// IMPÕE O MODDLEWARE
app.use(middlewareAutenticacao);

// POSTA HORARIO
app.post("/api/horario", async (req, res) => {
    try {

        const { pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento, id_cliente } = req.body;

        const validacaoResult = await validacaoGeral(pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento, id_cliente);

        if (!validacaoResult.valid) {
            return res.status(400).json({ message: validacaoResult.message });
        }

        const tempo = parseInt(validacaoResult.tempo)

        const validaClienteResult = await validaCliente(id_cliente);

        if (!validaClienteResult.valid) {
            return res.status(400).json({ message: validaCliente(id_cliente).message });
        }

        const buscaHorarios = await buscaHorariosPreenchidos(dia_atendimento)

        if (!buscaHorarios.valid) {
            return res.status(400).json({ message: buscaHorariosPreenchidos(dia_atendimento).message });
        }        

        const horarios = buscaHorarios.horarios

        let hora = horario_atendimento.split(":")[0]
        let minutos = horario_atendimento.split(":")[1]

        if(tempo == 60 && parseInt(minutos) == 30){
            hora.split()[0] == 0 && hora.split()[1] < 9? hora = `0${hora+1}` : hora.split()[0] == 0 && hora.split()[1] == 9? hora = `10` : hora
            minutos == "0"
        } else if(tempo == 60 && parseInt(minutos) == 0){
            minutos == "30"
        }
        
        let horarioExtendido = `${hora}:${minutos}`

        console.log(horario_atendimento)
        console.log(horarioExtendido)
        

        const buscaEspaco = await horarios.every(horario => (horario.horario_atendimento.split(":00")[0] !== horario_atendimento || horario.horario_atendimento.split(":00")[0] !== horarioExtendido)
        );

        if(!buscaEspaco){
            return res.status(400).json({ message: "Horários preenchidos" });
        }

        const insertHorarioQuery = "INSERT INTO horarios (pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, tempo_atendimento, dia_atendimento, id_cliente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        await pool.execute(insertHorarioQuery, [pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, tempo, dia_atendimento, id_cliente]);

        res.status(201).json({ message: "Horário criado com sucesso." });

    } catch (error) {
        console.error("Erro ao criar horário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
);


app.get("/api/horarios", async (req, res) => {
    try {
        const buscaHorariosQuery = "SELECT * FROM horarios";

        const [buscaHorarios] = await pool.execute(buscaHorariosQuery);

        res.status(200).json({ message: "Horários disponíveis.", horarios: buscaHorarios });
    } catch (error) {
        console.error("Erro ao buscar horários:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)


app.get("/api/horarios/:dia_atendimento", async (req, res) => {
    try {
        const { dia_atendimento } = req.params;

        const resultado = await buscaHorariosPreenchidos(dia_atendimento);

        if (!resultado.valid) {
            return res.status(400).json({ message: resultado.message });
        }

        res.status(200).json({ message: resultado.message, horarios: resultado.horarios });

    } catch (error) {
        console.error("Erro ao buscar horários:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)


app.delete("/api/horario/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const deleteHorarioQuery = "UPDATE horarios SET status_atual = 0 WHERE id = ?";

        await pool.execute(deleteHorarioQuery, [id]);

        res.status(200).json({ message: "Horário deletado com sucesso." });

    } catch (error) {
        console.error("Erro ao deletar horário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)

app.put("/api/horario/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento } = req.body;

        if (!validaHorario(pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento).valid) {
            return res.status(400).json({ message: validaHorario(pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento).message });
        }

        const validacaoResult = await validacaoGeral(pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, dia_atendimento, id_cliente);

        if (!validacaoResult.valid) {
            return res.status(400).json({ message: validacaoResult.message });
        }

        const tempo = validacaoResult.tempo

        const updateHorarioQuery = "UPDATE horarios SET pets = ?, tipo_atendimento = ?, modalidade = ?, endereco_busca = ?, horario_atendimento = ?, tempo_atendimento = ?, dia_atendimento = ? WHERE id = ?";

        await pool.execute(updateHorarioQuery, [pets, tipo_atendimento, modalidade, endereco_busca, horario_atendimento, tempo, dia_atendimento, id]);

        res.status(200).json({ message: "Horário atualizado com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar horário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)

app.put("/api/altera/horario/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { horario_atendimento, dia_atendimento } = req.body;

        if (!validaHorarioAtendimento(horario_atendimento).valid) {
            return res.status(400).json({ message: validaHorarioAtendimento(horario_atendimento).message });
        }

        if (!validaDiaAtendimento(dia_atendimento).valid) {
            return res.status(400).json({ message: validaDiaAtendimento(dia_atendimento).message });
        }

        const updateHorarioQuery = "UPDATE horarios SET horario_atendimento = ?, dia_atendimento = ? WHERE id = ?";

        await pool.execute(updateHorarioQuery, [horario_atendimento, dia_atendimento, id]);
        res.status(200).json({ message: "Horário alterado com sucesso." });
    } catch (error) {
        console.error("Erro ao alterar horário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)