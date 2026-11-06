import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { Protected } from "./components/protected";
import { AppLayout } from "./components/layout";
import LoginPage from "./pages/login";
import Consolidado from "./pages/index";
import Hoje from "./pages/hoje";
import Gestor from "./pages/gestor";
import Pipeline from "./pages/pipeline";
import Carteira from "./pages/carteira";
import Ficha from "./pages/ficha";
import Agenda from "./pages/agenda";
import Registro from "./pages/registro";
import Empreendimentos from "./pages/empreendimentos";
import Empreendimento from "./pages/empreendimento";
import Relatorios from "./pages/relatorios";
import Configuracoes from "./pages/configuracoes";
import { Empty } from "./components/ui/kit";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route>
          <Protected>
            <AppLayout>
              <Switch>
                <Route path="/" component={Consolidado} />
                <Route path="/hoje" component={Hoje} />
                <Route path="/gestor" component={Gestor} />
                <Route path="/pipeline" component={Pipeline} />
                <Route path="/carteira" component={Carteira} />
                <Route path="/imobiliarias/:id" component={Ficha} />
                <Route path="/agenda" component={Agenda} />
                <Route path="/registro" component={Registro} />
                <Route path="/empreendimentos" component={Empreendimentos} />
                <Route path="/empreendimentos/:id" component={Empreendimento} />
                <Route path="/relatorios" component={Relatorios} />
                <Route path="/configuracoes" component={Configuracoes} />
                <Route>
                  <Empty title="Página não encontrada" />
                </Route>
              </Switch>
            </AppLayout>
          </Protected>
        </Route>
      </Switch>
    </Provider>
  );
}

export default App;
