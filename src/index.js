import React from 'react';
import ReactDOM from 'react-dom';

import { scaleLinear } from "d3-scale";
import { format } from "d3-format";

import { ChartCanvas, Chart } from "react-stockcharts";
import { CandlestickSeries, LineSeries, AreaOnlySeries} from "react-stockcharts/lib/series";
import { XAxis, YAxis } from "react-stockcharts/lib/axes";
import { fitWidth } from "react-stockcharts/lib/helper";
import { HoverTooltip } from "react-stockcharts/lib/tooltip";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY, PriceCoordinate } from "react-stockcharts/lib/coordinates";

import './index.css';
import { rawData } from "./rawdata"


function SelectionBar(props) {
  const settings = {Exchange: ["quadrigacx", "kraken", "bittrex"],
                    Symbol: ["BTC", "ETH", "XMR"],
                    Price: ["BTC", "ETH", "XMR", "USD", "CAD"]
                   };
  let codeMap = {Exchange: "cx", Symbol: "sym", Price: "price"};
  let dropdown = [];
  for (let name in settings) {
    let items = [];
    for (let i = 0; i < settings[name].length; i++) {
      items.push(<span key={settings[name][i]} onClick={() => props.onClick(codeMap[name], settings[name][i])}>
                   {settings[name][i]}
                 </span>);
    }
    dropdown.push(<span key={name}>
                    <div className="dropdown-name">
                      {props.curState[codeMap[name]]}
                    </div>
                    <div className="dropdown-items">
                      {items}
                    </div>
                  </span>
                 );
  }
  return(
    <div className="settings">
      {dropdown}
    </div>
  );
}

class MemeLines extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: "loading",
      hist: null,
      T: 180,
      cx: "kraken",
      sym: "BTC",
      price: "USD"
    };
  }
  
  fetchData() {
    const self = this;
    let url = `https://min-api.cryptocompare.com/data/histoday?fsym=${this.state.sym}&tsym=${this.state.price}&limit=${this.state.T}&aggregate=1&e=${this.state.cx}`;
    fetch(url).then(function(response) {
      return response.json();
    }).then(function(histoday) {
      if (histoday.Response === "Success") {
        self.setState({status: "loaded", hist: self.createIchimoku(histoday.Data)});
      }
      else if (histoday.Response === "Error") {
        self.setState({status: "error"});
      }
    });
  }

  componentDidMount() {
    window.scrollBy({top: 999, left: 0, behavior: "smooth"});
    this.setState({status: "loaded", hist: this.createIchimoku(rawData.Data)});  
    //this.fetchData();  
  }

  componentDidUpdate(prevProps, prevState) {
    if ((prevState.cx !== this.state.cx) || 
        (prevState.sym !== this.state.sym) || 
        (prevState.price !== this.state.price)) {
      console.log(`cx: ${this.state.cx} sym: ${this.state.sym} price: ${this.state.price}`);
      //this.fetchData();
    }
  }

  handleClick(dropdownName, dropdownItem) {
    if (this.state[dropdownName] !== dropdownItem) {
      let newState = {};
      newState[dropdownName] = dropdownItem;
      newState["status"] = "loading";
      this.setState(newState);
    }
  }
  
  createIchimoku(cxData, tenkanParam=10, kijunParam=30) {
    let ichimokuData = [];
    for (let i = 0; i < cxData.length; i++) {
      ichimokuData.push({"open": cxData[i].open,
                         "close": cxData[i].close,
                         "high": cxData[i].high,
                         "low": cxData[i].low,
                         "x": i+1-cxData.length
                        });
    }
    for (let i = 0; i < kijunParam; i++) {
      ichimokuData.push({"x": i+1});
    }


    let releventIndices = {"tenkanSen": {"highIndices": [], "lowIndices": []},
                           "kijunSen": {"highIndices": [], "lowIndices": []},
                           "senkouSpanB": {"highIndices": [], "lowIndices": []}
                          };

    function slidingWindow(i, k, limits, data) {
      let h = limits.highIndices;
      let l = limits.lowIndices;
      if (i < k) {
        while (h.length > 0 && data[i].high >= data[h[h.length-1]].high)
          h.pop();
        while (l.length > 0 && data[i].low <= data[l[l.length-1]].low)
          l.pop();
        h.push(i);
        l.push(i);
      }
      else {
        while (h.length > 0 && h[0] <= i-k)
          h.shift();
        while (l.length > 0  && l[0] <= i-k)
          l.shift();
        while (h.length > 0 && data[i].high >= data[h[h.length-1]].high)
          h.pop();
        while (l.length > 0 && data[i].low <= data[l[l.length-1]].low)
          l.pop();
        h.push(i);
        l.push(i);
      }
      return {"limits": limits, "avg": (data[h[0]].high + data[l[0]].low) / 2};
    }

    let swReturn;
    for (let i = 0; i < cxData.length; i++) {
      swReturn = slidingWindow(i, tenkanParam, releventIndices.tenkanSen, cxData);
      releventIndices.tenkanSen = swReturn.limits;
      ichimokuData[i].tenkanSen = swReturn.avg;

      swReturn = slidingWindow(i, kijunParam, releventIndices.kijunSen, cxData);
      releventIndices.kijunSen = swReturn.limits;
      ichimokuData[i].kijunSen = swReturn.avg;

      swReturn = slidingWindow(i, kijunParam*2, releventIndices.senkouSpanB, cxData);
      releventIndices.senkouSpanB = swReturn.limits;
      ichimokuData[i+kijunParam].senkouSpanB = swReturn.avg;

      if (i >= kijunParam - 1) {
        ichimokuData[i+kijunParam].senkouSpanA = (ichimokuData[i].tenkanSen + ichimokuData[i].kijunSen) / 2;
        ichimokuData[i-kijunParam+1].chikouSpan = cxData[i].close;
      }
    }
    //console.table(ichimokuData);
    //for (let i = 0; i < k + kijunParam; i++) ichimokuData.shift();
    return ichimokuData;
  }

  renderChart() {
    if (this.state.status === "loaded") {
      let p = this.state.hist[this.state.T].close;
      console.log("rendering chart...");
      return(
        <ChartCanvas 
          height={400}
          ratio={this.props.ratio}
          width={this.props.width}
          margin={{left: 60, right: 80, top: 20, bottom: 30}}
          seriesName="test"
          type="hybrid"
          data={this.state.hist}
          xAccessor={d => d.x}
          displayXAccessor={d => d.x}
          xScale={scaleLinear()}
          clamp={true}
          useCrossHairStyleCursor={false}
        >
          <Chart padding={10} yExtents={d => [d.high, d.low, d.tenkanSen, d.kijunSen, d.senkouSpanA, d.senkouSpanB, d.chikouSpan]}>
            <XAxis axisAt="bottom" orient="bottom" ticks={8} />
            <YAxis axisAt="left" orient="left" ticks={6} stroke="#000000" />
            <YAxis axisAt="right" orient="right" ticks={6} stroke="#000000" />
            <CandlestickSeries widthRatio={0.4} />
            <LineSeries yAccessor={d => d.tenkanSen} stroke="#f91d1d" highlightOnHover={true} hoverTolerance={10} />
            <LineSeries yAccessor={d => d.kijunSen} stroke="#6af91d" highlightOnHover={true} hoverTolerance={10} />
            <LineSeries yAccessor={d => d.senkouSpanA} stroke="#ef19ef" highlightOnHover={true} hoverTolerance={10} />
            <LineSeries yAccessor={d => d.senkouSpanB} stroke="#1aefe4" highlightOnHover={true} hoverTolerance={10} />
            <LineSeries yAccessor={d => d.chikouSpan} stroke="#dbc300" highlightOnHover={true} hoverTolerance={10} />
            <AreaOnlySeries yAccessor={d => d.senkouSpanA} base={(s,d) => s(d.senkouSpanB)} fill="#7392c4" stroke="#7392c4" opacity={.4} />
            <PriceCoordinate orient="right" at="right" price={p} displayFormat={format("$.2f")} />
            <MouseCoordinateX displayFormat={format("+")} />
            <MouseCoordinateY orient="right" at="right" displayFormat={format("$.2f")} />
          </Chart>
          <CrossHairCursor />
        </ChartCanvas>
      );
    }
    else {
      console.log("rendering loader...");
      return(
        <div style={{height: 400}}>
          <div className="loader" />
        </div>
      );
    }
  }

  render() {
    return (
      <div className="chart-area">
        <SelectionBar curState={this.state} onClick={(key, val) => this.handleClick(key, val)}/>
        {this.renderChart()}
      </div>
    );
  }

}

//        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
class App extends React.Component {
  constructor(props) {
    super(props);
    //let init = [];
    //init.push(<MemeLines key={0}/>);
    this.state = {
      numCharts: 1
    };
  }

  handleClick() {
    //let newState = this.state.charts;
    //newState.push(<MemeLines key={newState.length}/>);
    this.setState({numCharts: this.state.numCharts+1});
  }

  render() {
    let charts = [];
    for (let i = 0; i < this.state.numCharts; i++) {
      charts.push(<MemeLines key={i}/>);
    }
    return (
      <div className="app">
        {charts}
        <button className="addChart" onClick={() => this.handleClick()}>New Chart</button>
      </div>
    );
  }
}

MemeLines = fitWidth(MemeLines);

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
