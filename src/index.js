import React from 'react';
import ReactDOM from 'react-dom';

import { scaleLinear } from "d3-scale";
import { format } from "d3-format";

import { ChartCanvas, Chart } from "react-stockcharts";
import { CandlestickSeries, LineSeries, AreaOnlySeries} from "react-stockcharts/lib/series";
import { XAxis, YAxis } from "react-stockcharts/lib/axes";
import { fitWidth } from "react-stockcharts/lib/helper";
//import { HoverTooltip } from "react-stockcharts/lib/tooltip";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY, PriceCoordinate } from "react-stockcharts/lib/coordinates";

import './index.css';

import { rawData } from "./rawdata"

class SelectionBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sym: this.props.curState["sym"],
      price: this.props.curState["price"],
      n: this.props.curState["n"]
    };
  }

  handleChange(key, event) {
    let newState = {};
    newState[key] = event.target.value;
    this.setState(newState);
  }

  render() {
    const dropdownSettings = {
      cx: ["quadrigacx", "kraken", "bittrex"],
      T: ["histoday", "histohour"]
    };
    let dropdown = [];
    for (let key in dropdownSettings) {
      let items = [];
      for (let i = 0; i < dropdownSettings[key].length; i++) {
        items.push(<span key={dropdownSettings[key][i]} onClick={() => this.props.onClick(key, dropdownSettings[key][i])}>
                     {dropdownSettings[key][i]}
                   </span>);
      }
      dropdown.push(<span key={key}>
                      <div className="dropdown-selection">
                        {this.props.curState[key]}
                      </div>
                      <div className="dropdown-items">
                        {items}
                      </div>
                    </span>
                   );
    }

    let textbox = [];
    for (let key in this.state) {
      textbox.push(
        <span key={key}>
          <form onSubmit={(e) => this.props.onSubmit(key, this.state[key], e)}>
            <input type="text" size="10" value={this.state[key]} onChange={(e) => this.handleChange(key, e)}/>
          </form>
        </span>
      );
    }

    return(
      <div className="settings">
        {dropdown}
        {textbox}
      </div>
    );
  }
}

class Ichimoku extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: "loading",
      hist: null,
      T: "histoday",
      n: 180,
      cx: "kraken",
      sym: "BTC",
      price: "USD"
    };
  }
  
  fetchData() {
    const self = this;
    let url = `https://min-api.cryptocompare.com/data/${this.state.T}?fsym=${this.state.sym}&tsym=${this.state.price}&limit=${this.state.n}&aggregate=1&e=${this.state.cx}`;
    fetch(url).then(function(response) {
      return response.json();
    }).then(function(jsonData) {
      if (jsonData.Response === "Success") {
        self.setState({status: "loaded", hist: self.createIchimoku(jsonData.Data)});
      }
      else if (jsonData.Response === "Error") {
        self.setState({status: "error"});
      }
    });
  }

  componentDidMount() {
    if (this.props.id !== 0) {
      window.scrollBy({top: 999, left: 0, behavior: "smooth"});
    }
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

  handleClick(dropdownKey, dropdownItem) {
    if (this.state[dropdownKey] !== dropdownItem) {
      let newState = {};
      newState[dropdownKey] = dropdownItem;
      newState["status"] = "loading";
      this.setState(newState);
    }
  }

  handleSubmit(textboxKey, textboxItem, event) {
    event.preventDefault();
    let newState = {};
    newState[textboxKey] = textboxItem;
    newState["status"] = "loading";
    this.setState(newState);
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


    let releventIndices = {
      "tenkanSen": {"highIndices": [], "lowIndices": []},
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
      let p = this.state.hist[this.state.n].close;
      //console.log("rendering chart...");
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
      //console.log("rendering loader...");
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
        <SelectionBar 
          curState={this.state} 
          onClick={(key, val) => this.handleClick(key, val)}
          onSubmit={(key, val, e) => this.handleSubmit(key, val, e)}
        />
        {this.renderChart()}
      </div>
    );
  }

}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      numCharts: 1
    };
  }

  handleClick() {
    this.setState({numCharts: this.state.numCharts+1});
  }

  render() {
    let charts = [];
    for (let i = 0; i < this.state.numCharts; i++) {
      charts.push(<Ichimoku key={i} id={i}/>);
    }
    return (
      <div className="app">
        {charts}
        <button className="addChart" onClick={() => this.handleClick()}>New Chart</button>
      </div>
    );
  }
}

Ichimoku = fitWidth(Ichimoku);

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
