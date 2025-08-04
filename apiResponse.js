//Require das bibliotecas

let ldapJs = require("ldapjs");
let env = require("dotenv");
let express = require("express");
let cors = require("cors");

//Inicialização do express (servidor node)

const app = express();
env.config();

// Configuração do rest (Cors é politicas de segurança (Caso haja erro, bote a URL do local onde estará sendo usado a API))
//Origin me diz que todo link pode utilizar este REST
//Methods: Métodos que serão usados (Porém utilizamos apenas o GET)
//AllowedHeaders: Campos que nos permitem configurar da nossa forma (content type: json, xml, html, word. Authorization: Serviço para senhas)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

//Credenciais para conexão ao AD
const config = {
  url: process.env.BASE_URL,
  baseDN: process.env.BASE_DN,
  username: process.env.USER_NAME,
  password: process.env.AD_PASSWORD,
};

//REST Api
app.get("/api/user/:username", (req, res) => {
  let client = ldapJs.createClient({ url: config.url });
  let userfound = false;
  //Função para conectar ao AD
  client.bind(config.username, config.password, (error) => {
    if (error) {
      console.log("Failed to bind: ", +JSON.stringify(error));
      return;
    }

    console.log("Successfully connected");
  });

  //Função que procura o usuario no AD
  //Parâmetros: scope (forma de busca), filter: (nome do usuario registrado que precisa ser buscado)
  //attributes: O que deve vir na response, se nn tiver, ele retornará tudo
  //Atributos configurados para buscar apenas o:
  //nome(cn), cargo(description), setor(department), email(mail), empresa(physicalDeliveryOfficeName)
  client.search(
    config.baseDN,
    {
      scope: "sub",
      filter: `sAMAccountname=${req.params.username}`,
      attributes: [
        "cn",
        "description",
        "department",
        "mail",
        "physicalDeliveryOfficeName",
      ],
    },
    (err, user) => {
      if (err) {
        res.status(500).json("Error");
        return;
      }

      //Response handlers para tratar a resposta da conexão de acordo com o status
      //Handle para mostrar sucesso na conexão e buscar o usuário
      user.on("searchEntry", (entry) => {
        userfound = true;
        res.json(entry.pojo.attributes);
        client.unbind((err) => {
          if (err) {
            console.log("error to unbind");
          } else {
            console.log("Disconnecting...");
          }
        });
      });

      //Handle para erros da conexão
      user.on("error", (result) => {
        console.log("Status: ", result.status);
        client.unbind((err) => {
          if (err) {
            console.log("error to unbind");
          } else {
            console.log("Disconnecting...");
          }
        });
        res.status(404).json({ message: "LDAP error" });
      });

      //Handle para caso não haja sucesso na busca do usuário
      user.on("end", (result) => {
        if (!userfound) {
          console.log("User not found");
          res.status(404).json({ error: "User not found" });
          client.unbind((err) => {
            if (err) {
              console.log("error to unbind");
            } else {
              console.log("Disconnecting...");
            }
          });
        }
      });
    }
  );
});

//Configuração para subir o servidor na porta atual de um server ou na porta 3000
app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`);
});

//OBS: O serviço LDAP conectado ao Node não pode estar constantemente no ar
//Caso ocorra, após a conexão com um tempo, ele irá desconectar automaticamente
//Assim, foi colocado a função pra ele automaticamente desconectar após uma pesquisa
//Junto disso, a conexão ao LDAP toda vez que buscamos um usuário.
