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
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database,
})

app.use(cors(corsOptions));

app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("Hello World!");
}
)

function middlewareAutenticacao(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "Token de autenticação não fornecido." });
    }


    const token = authHeader.split(" ");

    if(!token) {
        return res.status(401).json({ message: "Token de autenticação não fornecido." });
    }

    if(token[0] != "Bearer") {
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

function autentica(payload) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET não está definido no arquivo .env");
    }
    if(!payload || !payload.id || !payload.role) {
        throw new Error("Payload inválido para autenticação.");
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    return token;
}

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
function validaHorario(pets, tipo_atendimento, modalidade, endereco, id_cliente) {
    if (!pets || !tipo_atendimento || !modalidade ||  !endereco || !id_cliente) {
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
        if (!pet.nome || !pet.qualidade_pelo || !pet.idade) {
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

    return { valid: true };
}

function validaEndereco(endereco) {
    if (!endereco || !endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.estado) {
        return { valid: false, message: "Todos os campos do endereço são obrigatórios." };
    }



    return { valid: true };
}

async function validaCliente(cliente) {

    const buscaClienteQuery = "SELECT id FROM usuaiors WHERE id = ?";

    const buscaCliente = await pool.execute(buscaClienteQuery, [cliente.id]);

    const clienteExiste = buscaCliente[0].length > 0;

    if (!clienteExiste) {
        return { valid: false, message: "O cliente fornecido não existe." };
    }

    if(!cliente || !cliente.id) {
        return { valid: false, message: "O campo cliente é obrigatório." };
    }

    return { valid: true };
}

function validaTelefone(telefone) {
    const telefoneRegex = /^\d{10,11}$/; // Aceita apenas números com 10 ou 11 dígitos
    return telefoneRegex.test(telefone);
}   

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

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

        const validaTelefoneResult = validaTelefone(telefone);

        if (!validaTelefoneResult) {
            return res.status(400).json({ message: "O telefone fornecido não é válido. Deve conter apenas números e ter 10 ou 11 dígitos." });
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
        console.error("Erro ao criar usuário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
)

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

app.use(middlewareAutenticacao);
app.post("/api/horario", async (req, res) => {
    try {
        

        const { pets, tipo_atendimento, modalidade, endereco_busca, id_cliente } = req.body;

        if (!validaHorario(pets, tipo_atendimento, modalidade, endereco_busca, id_cliente).valid) {
            return res.status(400).json({ message: validaHorario(pets, tipo_atendimento, modalidade, endereco_busca, id_cliente).message });
        }

        if(!validaPets(pets).valid) {
            return res.status(400).json({ message: validaPets(pets).message });
        }

        if (!validaEndereco(endereco_busca).valid) {
            return res.status(400).json({ message: validaEndereco(endereco_busca).message });
        }

        if(!validaCliente(id_cliente).valid) {
            return res.status(400).json({ message: validaCliente(id_cliente).message });
        }
         
        if(!validaEndereco(endereco).valid) {
            return res.status(400).json({ message: validaEndereco(endereco).message });
        }

        const insertHorarioQuery = "INSERT INTO horarios (pets, tipo_atendimento, modalidade, endereco_busca, id_cliente) VALUES (?, ?, ?, ?, ?)";

        await pool.execute(insertHorarioQuery, [horario]);

        res.status(201).json({ message: "Horário criado com sucesso." });

    } catch (error) {
        console.error("Erro ao criar horário:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
}
);